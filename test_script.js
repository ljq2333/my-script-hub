"use strict";

const fs = require("fs");
const path = require("path");
// 使用 Node.js 内置 new Function() 做语法解析

const SCRIPT_FILE = path.join(__dirname, "视频播放控制器.user.js");

console.log(`\n=== 测试: ${path.basename(SCRIPT_FILE)} ===\n`);

const code = fs.readFileSync(SCRIPT_FILE, "utf-8");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${name}: ${e.message}`);
    failed++;
  }
}

// ============== 1. 元数据块检查 ==============
console.log("--- 元数据块 ---");

test("包含 ==UserScript== 头部", () => {
  if (!code.includes("// ==UserScript==")) throw new Error("缺少 UserScript 头部");
});

test("包含 ==/UserScript== 尾部", () => {
  if (!code.includes("// ==/UserScript==")) throw new Error("缺少 UserScript 尾部");
});

const metaBlock = code.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
test("元数据块格式正确", () => {
  if (!metaBlock) throw new Error("无法提取元数据块");
});

const meta = metaBlock ? metaBlock[1] : "";

test("包含 @name", () => {
  if (!/@name\s/.test(meta)) throw new Error("缺少 @name");
});

test("包含 @version", () => {
  if (!/@version\s/.test(meta)) throw new Error("缺少 @version");
});

test("包含 @match", () => {
  if (!/@match\s/.test(meta)) throw new Error("缺少 @match");
});

test("包含 @grant", () => {
  if (!/@grant\s/.test(meta)) throw new Error("缺少 @grant");
});

test("包含 @run-at", () => {
  if (!/@run-at\s/.test(meta)) throw new Error("缺少 @run-at");
});

// ============== 2. JavaScript 语法检查 ==============
console.log("\n--- JavaScript 语法 ---");

test("代码可以成功解析 (无语法错误)", () => {
  try {
    new Function(code);
  } catch (e) {
    throw new Error(`语法错误: ${e.message}`);
  }
});

// ============== 3. 结构检查 ==============
console.log("\n--- 代码结构 ---");

test("使用 IIFE 包裹 (函数自执行)", () => {
  if (!/\(\s*function\s*\(\)\s*\{/.test(code))
    throw new Error("未找到 IIFE 模式");
});

test("包含 'use strict'", () => {
  if (!code.includes('"use strict"') && !code.includes("'use strict'"))
    throw new Error("缺少 use strict");
});

test("全局状态变量已声明 (videoEl, observer 等)", () => {
  if (!/let\s+videoEl/.test(code)) throw new Error("缺少 videoEl 声明");
  if (!/\bobserver\s*=\s*null\b/.test(code)) throw new Error("缺少 observer 声明");
});

test("MutationObserver 已配置 subtree:true (支持 SPA)", () => {
  if (!/subtree:\s*true/.test(code))
    throw new Error("缺少 subtree: true — SPA 兼容性必需");
});

test("observer 不会被 cleanup() 断开", () => {
  const cleanupFn = code.match(/function cleanup\(\)[\s\S]*?\n  \}/);
  if (!cleanupFn) throw new Error("未找到 cleanup 函数");
  if (cleanupFn[0].includes("observer.disconnect"))
    throw new Error("cleanup() 中仍包含 observer.disconnect() — 这会导致 SPA 失效");
});

test("init() 包含 observer 重连逻辑", () => {
  const initFn = code.match(/function init\(\)[\s\S]*?\n  \}/);
  if (!initFn) throw new Error("未找到 init 函数");
  if (!initFn[0].includes("if (!observer)"))
    throw new Error("init() 中缺少 observer 重连检查");
});

test("水平面板包含刷新按钮 (REFRESH_BTN)", () => {
  if (!code.includes("REFRESH_BTN"))
    throw new Error("CONFIG 中缺少 REFRESH_BTN");
  if (!code.includes("重新检测视频"))
    throw new Error("缺少刷新按钮（重新检测视频）");
  if (!/refreshBtn/.test(code))
    throw new Error("缺少 refreshBtn 变量");
});

test("手动刷新期间 Observer 被屏蔽 (manualRefresh)", () => {
  if (!/manualRefresh\s*=\s*false/.test(code))
    throw new Error("缺少 manualRefresh 标志");
  if (!/if\s*\(\s*manualRefresh\s*\)\s*return/.test(code))
    throw new Error("Observer 中缺少 manualRefresh 防护");
});

// ============== 4. 关键函数存在性 ==============
console.log("\n--- 关键函数 ---");

const requiredFunctions = [
  "loadConfig",
  "saveConfig",
  "formatTime",
  "showSeek",
  "updateProgress",
  "findVideo",
  "createControls",
  "setupListeners",
  "cleanup",
  "init",
  "start",
  "showSettings",
  "applyPosition",
  "setupDrag",
  "rebuildPanel",
  "toggleVisibility",
  "renderSeekRow",
  "renderSpeedRow",
  "updateSpeedHighlight",
  "updateTotalTime",
];

requiredFunctions.forEach((fn) => {
  test(`存在函数: ${fn}()`, () => {
    if (!new RegExp(`function\\s+${fn}\\s*\\(`).test(code))
      throw new Error(`未找到函数 ${fn}`);
  });
});

// ============== 5. 核心变量引用检查 ==============
console.log("\n--- 核心变量引用 ---");

test("CONFIG 对象已定义", () => {
  if (!/const\s+CONFIG\s*=/.test(code)) throw new Error("CONFIG 未定义");
});

test("CONFIG.PREFIX 已定义", () => {
  if (!/PREFIX:\s*"/.test(code)) throw new Error("PREFIX 未定义");
});

// ============== 6. 未定义变量检查 ==============
console.log("\n--- 防御性检查 ---");

test("JSON.parse 调用均有 try-catch 保护", () => {
  const allJsonParse = (code.match(/JSON\.parse\(/g) || []).length;
  const wrappedJsonParse = (code.match(/try\s*\{[\s\S]*?JSON\.parse\(/g) || []).length
    + (code.match(/JSON\.parse\([\s\S]*?\}\s*catch/g) || []).length;
  if (allJsonParse === 0) return; // 没有 JSON.parse 调用，跳过
  if (allJsonParse > wrappedJsonParse)
    throw new Error(`${allJsonParse - wrappedJsonParse} 个 JSON.parse 调用未被 try-catch 包裹`);
});

test("start() 在脚本末尾被调用", () => {
  const lastLine = code.trim().split("\n").pop().trim();
  if (lastLine !== "})();") throw new Error("脚本末尾不是 })();");
  if (!/start\(\);/.test(code)) throw new Error("start() 未被调用");
});

// ============== 结果汇总 ==============
console.log("\n========================================");
console.log(`  结果: ${passed} 通过, ${failed} 失败, ${passed + failed} 总计`);
console.log("========================================\n");

if (failed > 0) {
  process.exit(1);
}
