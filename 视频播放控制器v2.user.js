// ==UserScript==
// @name         视频播放控制器（重构版）
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  面板优先配置的通用视频控制器：倍速/快进档位可编辑、全局快捷键、按站点记忆、亮度音量、全屏适配
// @author       You
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @downloadURL  https://github.com/ljq2333/my-script-hub/raw/main/%E8%A7%86%E9%A2%91%E6%92%AD%E6%94%BE%E6%8E%A7%E5%88%B6%E5%99%A8.user.js
// @updateURL    https://github.com/ljq2333/my-script-hub/raw/main/%E8%A7%86%E9%A2%91%E6%92%AD%E6%94%BE%E6%8E%A7%E5%88%B6%E5%99%A8.user.js
// ==/UserScript==
//
// ============================================================
//  初始化配置（脚本里的"初始化标识"）
//  在下方源码搜索 `const INIT =` 即可修改出厂默认值。
//  改完把 INIT.VERSION 加 1，下次加载会强制覆盖本地配置；
//  或把 INIT.FORCE 设为 true 临时强制重置，用完改回 false。
//  日常使用请优先在【面板 → ⚙ 设置】里修改，改完即时生效。
// ============================================================
(function() {
  "use strict";
  const CSS = `
.vc-panel, .vc-overlay, .vc-float, .vc-toast, .vc-seek-tip {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  box-sizing: border-box;
}
.vc-panel *, .vc-overlay *, .vc-float *, .vc-toast * { box-sizing: border-box; }

.vc-panel {
  --vc-opacity: .85;
  --vc-font: 14px;
  --vc-btn-font: 13px;
  --vc-panel-w: 190px;
  --vc-user-w: auto;
  --vc-user-h: auto;
  --vc-min-w: min(320px, calc(100vw - 16px));
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: var(--vc-user-w);
  height: var(--vc-user-h);
  min-width: var(--vc-min-w);
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  max-height: calc(100dvh - 16px);
  padding: 12px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 12px;
  background: rgba(14,14,18,var(--vc-opacity));
  color: #f0f0f0;
  font-size: var(--vc-font);
  box-shadow: 0 8px 28px rgba(0,0,0,.45);
  /* 只有把手可拖，整体用 move 光标会误导用户到处按 */
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;
  /* 关键：阻止浏览器把手势用于滚动页面，Pointer Events 才能持续收到移动 */
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
.vc-panel.vc-panel--embedded { position: absolute; z-index: 2147483647; }
.vc-panel.vc-dragging { cursor: grabbing; }
.vc-panel.is-hidden { display: none; }

/* 内容区独立滚动，触摸时纵向滚动、不误触拖拽 */
.vc-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.28) transparent;
}
.vc-body::-webkit-scrollbar { width: 6px; }
.vc-body::-webkit-scrollbar-track { background: transparent; }
.vc-body::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.28); border-radius: 3px;
}

.vc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 9px;
  border: 1px solid #4a4a55;
  border-radius: 6px;
  background: #2a2a33;
  color: #f0f0f0;
  font-size: var(--vc-btn-font);
  line-height: 1.3;
  cursor: pointer;
  transition: background .15s, border-color .15s;
}
.vc-btn:hover { background: #3b3b47; }
.vc-btn.is-active { background: #2196f3; border-color: #2196f3; color: #fff; }
.vc-btn.vc-btn--icon { padding: 3px 7px; font-size: calc(var(--vc-btn-font) + 2px); background: transparent; border-color: transparent; color: #b9b9c4; }
.vc-btn.vc-btn--icon:hover { color: #fff; background: rgba(255,255,255,.1); }

.vc-header { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; flex-wrap: wrap; }

.vc-row { display: flex; align-items: center; gap: 8px; }
.vc-row.is-collapsed { display: none; }
.vc-row > label { flex: 0 0 auto; color: #9a9aa8; font-size: .85em; min-width: 34px; }
.vc-row input[type="range"] { flex: 1; min-width: 0; accent-color: #ffd54f; cursor: pointer; }
.vc-row .vc-val { flex: 0 0 auto; min-width: 38px; text-align: right; color: #7ed6df; font-size: .9em; font-variant-numeric: tabular-nums; }

.vc-time { display: flex; align-items: center; gap: 8px; }
.vc-time .vc-cur { min-width: 46px; font-variant-numeric: tabular-nums; }
.vc-time .vc-total { color: #9a9aa8; font-variant-numeric: tabular-nums; }
.vc-time input[type="range"] { flex: 1; min-width: 60px; accent-color: #4caf50; cursor: pointer; }

.vc-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.vc-chips .vc-btn { min-width: 42px; }
.vc-speedval {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 52px; padding: 4px 8px; border-radius: 6px;
  background: #11131a; color: #7ed6df; font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.vc-play {
  padding: 7px 14px; border: none; border-radius: 6px;
  color: #fff; font-weight: 600; font-size: var(--vc-font);
  background: #28a745; cursor: pointer;
}
.vc-play.is-pause { background: #dc3545; }

/* 垂直布局：时间/进度在上，倍速列与快进列左右并排，播放键压底 */
.vc-panel--vertical { min-width: 0; width: var(--vc-user-w, var(--vc-panel-w)); padding: 9px; gap: 7px; }
.vc-panel--vertical .vc-body {
  display: grid;
  /* minmax(0,…) 必须写：默认 minmax(auto,1fr) 会让 −/读数/+ 的 min-content
     抢走宽度，把另一列压成一条缝 */
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
  align-content: start;
}
/* 默认每个区块横跨两列，只有两个档位列各占一半。
   列顺序：倍速在左、快进在右。靠 order 调整放置顺序，
   否则自动放置会把指定到第 2 列的元素挤到下一行。 */
.vc-panel--vertical .vc-body > * { grid-column: 1 / -1; }
.vc-panel--vertical .vc-body > .vc-time { order: 1; }
.vc-panel--vertical .vc-speeds { order: 2; grid-column: 1; }
.vc-panel--vertical .vc-seeks { order: 3; grid-column: 2; }
.vc-panel--vertical .vc-play { order: 4; }
.vc-panel--vertical .vc-row { order: 5; }
.vc-panel--vertical .vc-header { justify-content: center; gap: 2px; }
.vc-panel--vertical .vc-time { flex-wrap: wrap; gap: 4px 6px; }
/* 垂直模式把"当前 / 总时长"放同一行，进度条独占下一行，比竖排三行紧凑。
   必须显式 flex:0 0 100%，否则 .vc-time input 的 flex:1(basis 0) 会把它挤在同一条线上 */
.vc-panel--vertical .vc-time input[type="range"] {
  order: 1; flex: 0 0 100%; width: 100%; min-width: 0;
}
/* 两列内部都是单列排列，宽度撑满所在列 */
.vc-panel--vertical .vc-chips { display: grid; grid-template-columns: 1fr; gap: 3px; }
.vc-panel--vertical .vc-chips > .vc-btn { width: 100%; min-width: 0; padding: 4px 2px; }
/* −/读数/+ 组：水平下并排一横行；垂直下在倍速列里竖排，各占一格（与档位同宽） */
.vc-speedadj { display: flex; align-items: center; gap: 6px; }
.vc-speedadj .vc-btn { flex: 0 1 auto; min-width: 36px; }
.vc-speedadj .vc-speedval { flex: 1 1 auto; min-width: 46px; }
.vc-panel--vertical .vc-speedadj {
  grid-column: 1 / -1;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
}
.vc-panel--vertical .vc-speedadj .vc-btn { min-width: 0; padding: 4px 2px; }
.vc-panel--vertical .vc-speedadj .vc-speedval { min-width: 0; }
.vc-panel--vertical .vc-play { width: 100%; }
.vc-panel--vertical .vc-row > label { min-width: 0; }

/* 拖拽把手：整条横贯面板，是好拖的唯一入口 */
.vc-handle {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  width: 100%; height: 18px; margin: -6px 0 0;
  border-radius: 6px; background: rgba(255,255,255,.05);
  flex: 0 0 auto; cursor: grab; touch-action: none;
  transition: background .15s;
}
.vc-handle span {
  width: 4px; height: 4px; border-radius: 50%;
  background: #6a6a78; transition: background .15s;
}
.vc-handle:hover { background: rgba(255,255,255,.12); }
.vc-handle:hover span,
.vc-panel.vc-dragging .vc-handle span { background: #7ed6df; }
.vc-panel.vc-dragging .vc-handle { cursor: grabbing; background: rgba(126,214,223,.16); }
.vc-panel.vc-dragging { transition: none; }

/* 显示/隐藏浮动按钮 */
.vc-float {
  position: fixed; z-index: 2147483000;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  padding: 8px 14px; border: 1px solid #555; border-radius: 8px;
  background: #33333d; color: #fff; font-size: 13px; cursor: pointer;
}
.vc-float.is-hidden { display: none; }

/* 累计快进提示：挂在 body 上，避免被面板 overflow 裁剪 */
.vc-seek-tip {
  position: fixed; z-index: 2147483647;
  padding: 4px 12px; border-radius: 6px;
  background: rgba(0,0,0,.88); color: #fff; font-size: 13px;
  white-space: nowrap; opacity: 0; transition: opacity .2s; pointer-events: none;
  transform: translateX(-50%);
}
.vc-seek-tip.is-show { opacity: 1; }

/* Toast */
.vc-toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  z-index: 2147483647; padding: 9px 18px; border-radius: 8px;
  background: rgba(39,174,96,.96); color: #fff; font-size: 13px;
  opacity: 0; transition: opacity .25s; pointer-events: none;
}
.vc-toast.is-error { background: rgba(231,76,60,.96); }
.vc-toast.is-show { opacity: 1; }

/* 设置面板 */
.vc-overlay {
  position: fixed; inset: 0; z-index: 2147483646;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.62);
  padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom));
}
.vc-dialog {
  width: 520px; max-width: 100%; max-height: 88vh; max-height: 88dvh; overflow-y: auto;
  padding: 18px 20px; border: 1px solid #34344a; border-radius: 14px;
  background: #1a1a28; color: #eaeaf0; font-size: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.6);
  -webkit-overflow-scrolling: touch;
}
.vc-dialog h3 { margin: 0; font-size: 18px; }
.vc-dialog-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #34344a; margin-bottom: 14px; }
.vc-section { margin-bottom: 14px; padding: 12px; border-radius: 10px; background: #232336; }
.vc-section h4 { margin: 0 0 10px; font-size: 14px; color: #7ed6df; }
.vc-field { display: flex; align-items: center; gap: 10px; margin: 9px 0; flex-wrap: wrap; }
.vc-field > label { flex: 0 0 92px; color: #aaaabc; font-size: 13px; }
.vc-field input[type="range"] { flex: 1; min-width: 100px; accent-color: #3498db; cursor: pointer; }
.vc-field input[type="number"], .vc-field input[type="text"], .vc-field select, .vc-dialog textarea {
  padding: 5px 8px; border: 1px solid #4a4a5c; border-radius: 6px;
  background: #16161f; color: #eee; font-size: 13px; width: 92px;
}
.vc-field .vc-hint { color: #85859a; font-size: 12px; }
.vc-field .vc-val { min-width: 44px; text-align: right; color: #7ed6df; font-variant-numeric: tabular-nums; }
.vc-scope { display: flex; align-items: center; gap: 14px; padding: 8px 10px; margin-bottom: 12px; border-radius: 8px; background: #20203a; font-size: 13px; flex-wrap: wrap; }
.vc-scope label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.vc-scope .vc-tag { margin-left: auto; color: #85859a; font-size: 12px; }

/* 档位编辑 chips */
.vc-editor { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.vc-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px; border: 1px solid #4a4a5c; border-radius: 14px;
  background: #2b2b3c; font-size: 12px; font-variant-numeric: tabular-nums;
}
.vc-chip button { border: none; background: none; color: #ff8a80; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; }
.vc-chip-add { display: inline-flex; align-items: center; gap: 4px; }
.vc-chip-add input { width: 68px !important; }
.vc-editor-note { color: #85859a; font-size: 12px; margin-top: 6px; }

/* 档位 chip：↑↓ 调序 + × 删除 */
.vc-chip { padding: 3px 6px 3px 4px; gap: 4px; }
.vc-chip-move {
  border: none; background: rgba(255,255,255,.06); color: #b9b9c8;
  border-radius: 4px; cursor: pointer; font-size: 11px; line-height: 1;
  padding: 3px 4px;
}
.vc-chip-move:hover:not(:disabled) { background: rgba(126,214,223,.24); color: #fff; }
.vc-chip-move:disabled { opacity: .25; cursor: not-allowed; }
.vc-chip-del {
  border: none; background: none; color: #ff8a80; cursor: pointer;
  font-size: 14px; line-height: 1; padding: 0 2px;
}

.vc-init-box { border: 1px solid #b8860b; background: #2a2418; }
.vc-init-box h4 { color: #ffca28; }
.vc-init-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #b9b0a0; }
.vc-init-meta code { padding: 1px 6px; border-radius: 4px; background: #16161f; color: #ffca28; }

.vc-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #34344a; flex-wrap: wrap; }
.vc-actions .vc-right { display: flex; gap: 8px; margin-left: auto; }
.vc-btn-lg { padding: 8px 18px; border: none; border-radius: 7px; color: #fff; font-size: 13px; cursor: pointer; }
.vc-btn-primary { background: #27ae60; }
.vc-btn-primary:hover { background: #219653; }
.vc-btn-plain { background: #4a4a58; }
.vc-btn-warn { background: #e67e22; }
.vc-btn-ghost { background: transparent; border: 1px solid #4a4a5c; }
.vc-dialog textarea { width: 100%; height: 92px; resize: vertical; margin-top: 8px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
.vc-io-row { display: flex; gap: 8px; flex-wrap: wrap; }
.vc-kbd-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.vc-kbd-table td { padding: 3px 6px; border-bottom: 1px solid #2e2e42; color: #b9b9c8; }
.vc-kbd-table td:first-child { width: 130px; color: #7ed6df; font-family: ui-monospace, Menlo, Consolas, monospace; }

/* ============ 移动端 / 触摸设备适配 ============ */
@media (max-width: 640px), (pointer: coarse) {
  .vc-panel { padding: 10px; gap: 8px; border-radius: 10px; }
  /* 两列并排时列太窄不好点，触摸设备给竖条一个最小宽度 */
  .vc-panel--vertical { min-width: min(210px, calc(100vw - 16px)); }
  .vc-btn { min-height: 36px; padding: 8px 10px; font-size: max(var(--vc-btn-font), 13px); }
  .vc-btn.vc-btn--icon { min-width: 36px; min-height: 36px; padding: 6px; }
  .vc-chips { gap: 6px; }
  .vc-chips .vc-btn { min-width: 52px; }
  .vc-speedval { min-height: 36px; }
  .vc-play { min-height: 42px; font-size: max(var(--vc-font), 15px); }
  .vc-row input[type="range"] { height: 30px; }
  .vc-time input[type="range"] { height: 30px; }
  .vc-handle { height: 26px; margin: -8px 0 -2px; }
  .vc-handle span { width: 5px; height: 5px; }

  .vc-dialog { padding: 14px; border-radius: 12px; }
  .vc-field > label { flex: 0 0 100%; }
  .vc-field input[type="number"], .vc-field input[type="text"], .vc-field select { width: 100%; min-height: 38px; }
  .vc-field input[type="range"] { min-width: 0; width: 100%; }
  .vc-btn-lg { min-height: 40px; }
  .vc-actions { flex-direction: column; align-items: stretch; }
  .vc-actions .vc-right { margin-left: 0; }
  .vc-actions .vc-right .vc-btn-lg { flex: 1; }
  .vc-scope .vc-tag { margin-left: 0; width: 100%; }
}

/* 超窄屏（小手机竖屏）：进一步压缩 */
@media (max-width: 380px) {
  .vc-panel { padding: 8px; gap: 6px; }
  .vc-chips .vc-btn { min-width: 0; }
  .vc-panel--vertical .vc-groups { gap: 4px; }
}

@media (prefers-reduced-motion: reduce) {
  .vc-btn, .vc-seek-tip, .vc-toast { transition: none; }
}
`;
  let styleNode = null;
  function injectStyles() {
    if (styleNode && document.contains(styleNode)) return;
    styleNode = document.createElement("style");
    styleNode.id = "vc-styles";
    styleNode.textContent = CSS;
    (document.head || document.documentElement).appendChild(styleNode);
  }
  const PREFIX = "VideoCtrl";
  const logger = {
    log(...args) {
    },
    warn(...args) {
      console.warn(`[${PREFIX}]`, ...args);
    },
    error(...args) {
      console.error(`[${PREFIX}]`, ...args);
    }
  };
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === void 0 || v === null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "style") node.setAttribute("style", v);
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "value") {
        node.value = v;
      } else {
        node.setAttribute(k, v === true ? "" : String(v));
      }
    }
    const list = Array.isArray(children) ? children : [children];
    for (const c of list) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }
  const pad = (n) => String(n).padStart(2, "0");
  function formatTime(t) {
    if (!Number.isFinite(t) || t < 0) return "00:00";
    const h = Math.floor(t / 3600);
    const m = Math.floor(t % 3600 / 60);
    const s = Math.floor(t % 60);
    return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  function formatSeek(total) {
    const sign = total < 0 ? "- " : "+ ";
    const abs = Math.round(Math.abs(total));
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return sign + (m ? `${m}m${s ? ` ${s}s` : ""}` : `${s}s`);
  }
  function formatSeekLabel(sec) {
    const sign = sec >= 0 ? "+" : "-";
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    if (m && s) return `${sign}${m}m${s}s`;
    if (m) return `${sign}${m}m`;
    return `${sign}${s}s`;
  }
  const clamp$1 = (n, min, max) => Math.max(min, Math.min(max, n));
  function throttle(fn, wait = 120) {
    let last = 0;
    let timer = null;
    return (...args) => {
      const now = Date.now();
      const remain = wait - (now - last);
      if (remain <= 0) {
        clearTimeout(timer);
        timer = null;
        last = now;
        fn(...args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn(...args);
        }, remain);
      }
    };
  }
  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true || !!target.closest?.("input, textarea, select, [contenteditable]");
  }
  const KEY = "VideoCtrl_";
  const hasGM = () => typeof GM_getValue === "function" && typeof GM_setValue === "function";
  function readRaw(key) {
    try {
      if (hasGM()) return GM_getValue(KEY + key, void 0);
      const v = localStorage.getItem(KEY + key);
      return v === null ? void 0 : v;
    } catch (e) {
      return void 0;
    }
  }
  function writeRaw(key, value) {
    try {
      if (hasGM()) {
        GM_setValue(KEY + key, value);
      } else {
        localStorage.setItem(KEY + key, JSON.stringify(value));
      }
    } catch (e) {
    }
  }
  const storage = {
    // 统一按 JSON 读写；GM_* 会把对象自动序列化，这里额外兼容字符串
    get(key, fallback) {
      const raw = readRaw(key);
      if (raw === void 0 || raw === null || raw === "") return fallback;
      try {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      writeRaw(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  };
  const INIT = {
    VERSION: 3,
    FORCE: false,
    DEFAULTS: {
      // 预设倍速档位。数组顺序就是面板上的显示顺序（面板里可用 ↑↓ 调整）
      speeds: [3, 2, 1.5, 1.25, 1, 0.75],
      // 快进/快退档位，单位秒。同上，数组顺序即显示顺序
      seeks: [-600, -60, -10, 10, 60, 300, 600],
      // −/+ 按钮每次调整幅度
      speedStep: 0.25,
      // 面板样式（透明度、字体、按钮字号）与视频画面（亮度、音量）
      ui: {
        opacity: 0.85,
        fontSize: 14,
        btnSize: 14,
        brightness: 1,
        volume: 1,
        // 面板尺寸，单位 px；0 表示自适应内容/屏幕
        panelWidth: 0,
        panelHeight: 0
      },
      // auto = 跟随屏幕自动；horizontal / vertical = 用户显式指定
      // 用 auto 而不是直接落死一个方向，才能在窄屏下切换回横向不被"自动"抢回去
      layout: "auto",
      // 是否启用全局快捷键
      shortcuts: true
    }
  };
  const POSITION_DEFAULT = { mode: "proportional", x: 0.5, y: 0.5 };
  const VISIBLE_DEFAULT = true;
  const SPEED_MIN = 0.1;
  const SPEED_MAX = 16;
  const SEEK_MIN = -3600;
  const SEEK_MAX = 3600;
  const VALIDATORS = {
    "ui.opacity": { min: 0.3, max: 1, step: 0.05 },
    "ui.fontSize": { min: 12, max: 24, step: 1 },
    "ui.btnSize": { min: 10, max: 22, step: 1 },
    "ui.brightness": { min: 0.1, max: 2, step: 0.05 },
    "ui.volume": { min: 0, max: 1, step: 0.05 },
    "ui.panelWidth": { min: 0, max: 2e3, step: 10 },
    "ui.panelHeight": { min: 0, max: 2e3, step: 10 },
    speedStep: { min: 0.1, max: 5, step: 0.05 }
  };
  const LAYOUTS = ["auto", "horizontal", "vertical"];
  const MOBILE_BREAKPOINT = 640;
  const K_VERSION = "version";
  const K_GLOBAL = "global";
  const K_SITES = "sites";
  const K_POS = "pos";
  const K_VISIBLE = "visible";
  const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  function deepMerge(base, patch) {
    if (!isPlainObject(patch)) return base;
    const out = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      if (isPlainObject(v) && isPlainObject(out[k])) {
        out[k] = deepMerge(out[k], v);
      } else if (v !== void 0) {
        out[k] = v;
      }
    }
    return out;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function cleanNumber(value, rule, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp(n, rule.min, rule.max);
  }
  function sanitize(input, base = INIT.DEFAULTS, path = "") {
    if (!isPlainObject(input)) return {};
    const out = {};
    for (const [key, defVal] of Object.entries(base)) {
      if (!(key in input)) continue;
      const val = input[key];
      const ownPath = path ? `${path}.${key}` : key;
      if (Array.isArray(defVal)) {
        if (!Array.isArray(val)) continue;
        let arr;
        if (key === "speeds") {
          arr = val.map(Number).filter((n) => Number.isFinite(n)).map((n) => clamp(n, SPEED_MIN, SPEED_MAX));
        } else if (key === "seeks") {
          arr = val.map(Number).filter((n) => Number.isFinite(n) && n !== 0).map((n) => clamp(Math.trunc(n), SEEK_MIN, SEEK_MAX));
        } else {
          arr = val;
        }
        const uniq = [...new Set(arr)];
        if (uniq.length) out[key] = uniq;
      } else if (isPlainObject(defVal)) {
        const sub = sanitize(val, defVal, ownPath);
        if (Object.keys(sub).length) out[key] = sub;
      } else if (typeof defVal === "number") {
        const rule = VALIDATORS[ownPath];
        out[key] = rule ? cleanNumber(val, rule, defVal) : Number(val);
        if (!Number.isFinite(out[key])) out[key] = defVal;
      } else if (typeof defVal === "boolean") {
        out[key] = !!val;
      } else if (typeof defVal === "string") {
        out[key] = key === "layout" && !LAYOUTS.includes(val) ? defVal : String(val);
      }
    }
    return out;
  }
  function numOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function cleanPosition(pos) {
    if (!isPlainObject(pos)) return { ...POSITION_DEFAULT };
    if (pos.mode === "absolute") {
      return {
        mode: "absolute",
        px: clamp(numOr(pos.px, 10), 0, 1e5),
        py: clamp(numOr(pos.py, 10), 0, 1e5)
      };
    }
    return {
      mode: "proportional",
      x: clamp(numOr(pos.x, 0.5), 0, 1),
      y: clamp(numOr(pos.y, 0.5), 0, 1)
    };
  }
  function diffFrom(cfg, base) {
    if (!isPlainObject(cfg)) return {};
    const out = {};
    for (const [key, defVal] of Object.entries(base)) {
      if (!(key in cfg)) continue;
      const val = cfg[key];
      if (Array.isArray(defVal)) {
        if (JSON.stringify(val) !== JSON.stringify(defVal)) out[key] = val;
      } else if (isPlainObject(defVal)) {
        const sub = diffFrom(val, defVal);
        if (Object.keys(sub).length) out[key] = sub;
      } else if (val !== defVal) {
        out[key] = val;
      }
    }
    return out;
  }
  class ConfigManager {
    constructor() {
      this.initialized = false;
      this.scope = "global";
      this.host = location.hostname || "unknown";
    }
    // 最优先判断：是否需要用出厂默认覆盖本地配置
    // 命中条件：FORCE 打开 / 版本号与本地不一致 / 本地从未写过版本号
    load() {
      const saved = storage.get(K_VERSION, null);
      const needInit = saved === null || saved !== INIT.VERSION;
      if (needInit) {
        this.applyInitial(true);
      }
      this.initialized = needInit;
      return needInit;
    }
    // 「恢复初始配置」按钮 + 初始化命中都走这里
    applyInitial(silent = false) {
      storage.set(K_VERSION, INIT.VERSION);
      storage.set(K_GLOBAL, {});
      storage.set(K_SITES, {});
      storage.set(K_POS, POSITION_DEFAULT);
      storage.set(K_VISIBLE, VISIBLE_DEFAULT);
      return silent;
    }
    // 当前生效配置（默认 + 全局差异 + 当前站点差异）
    get() {
      const g = sanitize(storage.get(K_GLOBAL, {}));
      const sites = storage.get(K_SITES, {});
      const s = isPlainObject(sites) ? sanitize(sites[this.host] || {}) : {};
      return deepMerge(deepMerge(clone(INIT.DEFAULTS), g), s);
    }
    // 某层的"继承基线"：改回基线值 = 从该层删除该项
    baseline(scope) {
      if (scope === "site") {
        return deepMerge(clone(INIT.DEFAULTS), sanitize(storage.get(K_GLOBAL, {})));
      }
      return clone(INIT.DEFAULTS);
    }
    // 读取某一层的原始差异（用于设置面板展示"该层改了什么"）
    getLayer(scope = this.scope) {
      if (scope === "site") {
        const sites = storage.get(K_SITES, {});
        return isPlainObject(sites) ? sanitize(sites[this.host] || {}) : {};
      }
      return sanitize(storage.get(K_GLOBAL, {}));
    }
    // 保存补丁到指定作用域。
    // 关键：先与"该层已有的值"合并，再与 baseline 做差，最后整层写回。
    // 这样"把某项改回默认"会真正从层里移除该项，而不是被旧值盖住。
    save(patch, scope = this.scope) {
      const clean = sanitize(patch);
      const next = diffFrom(
        deepMerge(this.getLayer(scope), clean),
        this.baseline(scope)
      );
      if (scope === "site") {
        const sites = storage.get(K_SITES, {});
        const all = isPlainObject(sites) ? sites : {};
        if (Object.keys(next).length) {
          all[this.host] = next;
        } else {
          delete all[this.host];
        }
        storage.set(K_SITES, all);
      } else {
        storage.set(K_GLOBAL, next);
      }
    }
    // 清除当前作用域的用户差异，回落到上一层
    clearScope(scope = this.scope) {
      if (scope === "site") {
        const sites = storage.get(K_SITES, {});
        if (isPlainObject(sites)) {
          delete sites[this.host];
          storage.set(K_SITES, sites);
        }
      } else {
        storage.set(K_GLOBAL, {});
      }
    }
    // ---------- 全局运行时状态（不按站点区分） ----------
    getPosition() {
      return cleanPosition(storage.get(K_POS, POSITION_DEFAULT));
    }
    savePosition(pos) {
      storage.set(K_POS, cleanPosition(pos));
    }
    getVisible() {
      const v = storage.get(K_VISIBLE, VISIBLE_DEFAULT);
      return typeof v === "boolean" ? v : VISIBLE_DEFAULT;
    }
    saveVisible(v) {
      storage.set(K_VISIBLE, !!v);
    }
    // ---------- 导入 / 导出 ----------
    exportConfig() {
      return JSON.stringify(
        {
          format: "video-controller-config",
          version: 3,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          global: sanitize(storage.get(K_GLOBAL, {})),
          sites: storage.get(K_SITES, {})
        },
        null,
        2
      );
    }
    importConfig(text) {
      const obj = JSON.parse(text);
      if (!isPlainObject(obj)) throw new Error("配置格式不正确");
      const sites = isPlainObject(obj.sites) ? obj.sites : {};
      const cleaned = {};
      for (const [host, patch] of Object.entries(sites)) {
        if (isPlainObject(patch) && host) {
          const c = sanitize(patch);
          if (Object.keys(c).length) cleaned[host] = c;
        }
      }
      storage.set(K_VERSION, INIT.VERSION);
      storage.set(K_GLOBAL, sanitize(obj.global));
      storage.set(K_SITES, cleaned);
    }
  }
  const MIN_SIZE = 200;
  function findVideo() {
    const candidates = [];
    const collect = (root, ctxScore = 0) => {
      try {
        root.querySelectorAll("video").forEach((v) => {
          if (v.offsetWidth < MIN_SIZE || v.offsetHeight < MIN_SIZE) return;
          if (!v.src && !v.querySelector("source") && !v.currentSrc) return;
          let score = ctxScore;
          if (v.hasAttribute("controls")) score += 10;
          if (v.hasAttribute("autoplay")) score += 5;
          if (!v.paused) score += 15;
          const doc = v.ownerDocument;
          if (doc && v === doc.activeElement) score += 20;
          score += Math.min(v.offsetWidth * v.offsetHeight / 1e4, 30);
          candidates.push({ video: v, score });
        });
        root.querySelectorAll("iframe").forEach((f) => {
          try {
            if (f.contentDocument) collect(f.contentDocument, ctxScore + 5);
          } catch (e) {
          }
        });
        root.querySelectorAll("*").forEach((h) => {
          if (h.shadowRoot) collect(h.shadowRoot, ctxScore);
        });
      } catch (e) {
      }
    };
    collect(document);
    if (!candidates.length) return null;
    candidates.sort(
      (a, b) => b.score - a.score || b.video.offsetWidth * b.video.offsetHeight - a.video.offsetWidth * a.video.offsetHeight
    );
    logger.log(`找到 ${candidates.length} 个视频，最佳评分 ${candidates[0].score}`);
    return candidates[0].video;
  }
  class Draggable {
    constructor(target, options = {}) {
      this.target = target;
      this.options = {
        getBounds: () => ({
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: window.innerHeight
        }),
        // 返回 true 表示该元素上按下不拖拽（按钮、滑块、内容区等）
        shouldIgnore: () => false,
        onStart: () => {
        },
        onEnd: () => {
        },
        onCancel: () => {
        },
        ...options
      };
      this.dragging = false;
      this._active = false;
      this._pointerId = null;
      this._startX = 0;
      this._startY = 0;
      this._originX = 0;
      this._originY = 0;
      this._startW = 0;
      this._startH = 0;
      this._lastLeft = 0;
      this._lastTop = 0;
      this._suppressClick = false;
      this._handlers = [];
      this._attached = false;
      this._raf = 0;
    }
    _on(node, type, fn, opts) {
      node.addEventListener(type, fn, opts);
      this._handlers.push([node, type, fn, opts]);
    }
    // 目标为 absolute 定位时，style.left 的参照系是 offsetParent，不是视口
    _origin() {
      const pos = getComputedStyle(this.target).position;
      if (pos === "absolute") {
        const p = this.target.offsetParent;
        if (p && p !== document.body && p !== document.documentElement) {
          const r = p.getBoundingClientRect();
          return { x: r.left + p.clientLeft, y: r.top + p.clientTop };
        }
      }
      return { x: 0, y: 0 };
    }
    // 阈值区分设备：鼠标精确，触摸抖动大，阈值高一些避免误拖
    _threshold(e) {
      return e.pointerType === "touch" || e.pointerType === "pen" ? 8 : 4;
    }
    _down(e) {
      if (e.button !== void 0 && e.button > 0) return;
      if (e.isPrimary === false) return;
      if (this._active) return;
      this._suppressClick = false;
      if (this.options.shouldIgnore(e.target)) return;
      const rect = this.target.getBoundingClientRect();
      const o = this._origin();
      this._startW = rect.width;
      this._startH = rect.height;
      this._originX = rect.left - o.x;
      this._originY = rect.top - o.y;
      this._lastLeft = this._originX;
      this._lastTop = this._originY;
      this._startX = e.clientX;
      this._startY = e.clientY;
      this._pointerId = e.pointerId;
      this._active = true;
      this.dragging = false;
      try {
        this.target.setPointerCapture?.(e.pointerId);
      } catch (_) {
      }
    }
    _move(e) {
      if (!this._active) return;
      if (this._pointerId !== null && e.pointerId !== this._pointerId) return;
      if (!this.dragging) {
        const dist = Math.hypot(e.clientX - this._startX, e.clientY - this._startY);
        if (dist < this._threshold(e)) return;
        this.dragging = true;
        this.target.classList.add("vc-dragging");
        this.options.onStart();
      }
      this._nextX = e.clientX;
      this._nextY = e.clientY;
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._paint(this._nextX, this._nextY);
      });
    }
    _paint(clientX, clientY) {
      const b = this.options.getBounds();
      const o = this._origin();
      const minX = b.left - o.x;
      const minY = b.top - o.y;
      const maxX = minX + Math.max(0, b.width - this._startW);
      const maxY = minY + Math.max(0, b.height - this._startH);
      const nx = clamp$1(
        this._originX + (clientX - this._startX),
        minX,
        Math.max(minX, maxX)
      );
      const ny = clamp$1(
        this._originY + (clientY - this._startY),
        minY,
        Math.max(minY, maxY)
      );
      this._lastLeft = nx;
      this._lastTop = ny;
      this.target.style.left = `${Math.round(nx)}px`;
      this.target.style.top = `${Math.round(ny)}px`;
    }
    // committed=true 表示正常抬起（保存），false 表示被取消（回滚）
    _end(committed) {
      if (!this._active) return;
      const wasDragging = this.dragging;
      this._active = false;
      this.dragging = false;
      this._pointerId = null;
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = 0;
      }
      this.target.classList.remove("vc-dragging");
      if (!wasDragging) return;
      this._suppressClick = true;
      if (committed) {
        this.options.onEnd({ left: this._lastLeft, top: this._lastTop });
      } else {
        this.target.style.left = `${Math.round(this._originX)}px`;
        this.target.style.top = `${Math.round(this._originY)}px`;
        this.options.onCancel();
      }
    }
    attach() {
      if (this._attached) return;
      this._attached = true;
      this._on(this.target, "pointerdown", (e) => this._down(e));
      for (const node of [this.target, window]) {
        this._on(node, "pointermove", (e) => this._move(e), { passive: true });
        this._on(node, "pointerup", (e) => {
          if (this._pointerId !== null && e.pointerId !== this._pointerId) return;
          this._end(true);
        });
        this._on(node, "pointercancel", () => this._end(false));
      }
      this._on(this.target, "lostpointercapture", () => this._end(true));
      this._on(
        window,
        "click",
        (e) => {
          if (!this._suppressClick) return;
          this._suppressClick = false;
          e.stopPropagation();
          e.preventDefault();
        },
        true
      );
      this._on(this.target, "dragstart", (e) => e.preventDefault());
    }
    destroy() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      for (const [node, type, fn, opts] of this._handlers) {
        node.removeEventListener(type, fn, opts);
      }
      this._handlers = [];
      this._attached = false;
      this.dragging = false;
      this._active = false;
      this._pointerId = null;
    }
  }
  let toastNode = null;
  let toastTimer = null;
  function showToast(msg, isError = false) {
    if (!toastNode) {
      toastNode = el("div", { class: "vc-toast", id: "vc-toast" });
      document.body.appendChild(toastNode);
    }
    toastNode.textContent = msg;
    toastNode.classList.toggle("is-error", !!isError);
    toastNode.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode?.classList.remove("is-show"), 2e3);
  }
  const stop$1 = (fn) => (e) => {
    e.stopPropagation();
    fn(e);
  };
  const NO_DRAG_SELECTOR = [
    "button",
    "input",
    "select",
    "textarea",
    "a",
    "label",
    ".vc-body",
    ".vc-no-drag"
  ].join(",");
  class Panel {
    constructor({ config, onAction, getBounds }) {
      this.config = config;
      this.onAction = onAction;
      this.getBounds = getBounds;
      this.panel = null;
      this.floatBtn = null;
      this.drag = null;
      this.refs = { blocks: {}, headerBtns: {} };
      this.seekTotal = 0;
      this.seekTimer = null;
      this.visible = true;
    }
    // ---------- 构建（只构建一次，布局与顺序靠重排 + CSS class 切换） ----------
    mount() {
      this.panel = el("div", { class: "vc-panel", id: "vc-panel" });
      this.refs.handle = el("div", {
        class: "vc-handle",
        title: "按住拖动面板",
        html: "<span></span><span></span><span></span>"
      });
      this.panel.appendChild(this.refs.handle);
      const r = this.refs;
      r.header = el("div", { class: "vc-header" });
      const iconBtn = (key, text, title, action) => {
        const btn = el("button", {
          class: "vc-btn vc-btn--icon",
          html: text,
          title,
          dataset: { vcHeader: key },
          onClick: stop$1(() => this.onAction(action))
        });
        r.headerBtns[key] = btn;
        return btn;
      };
      iconBtn("settings", "⚙", "参数设置", "open-settings");
      iconBtn("layout", "↕", "切换水平/垂直布局", "toggle-layout");
      iconBtn("brightness", "☀", "亮度", "toggle-brightness");
      iconBtn("volume", "🔊", "音量", "toggle-volume");
      iconBtn("refresh", "🔄", "重新检测视频", "refresh");
      iconBtn("visibility", "👁", "隐藏面板", "toggle-visibility");
      r.header.append(
        r.headerBtns.settings,
        r.headerBtns.layout,
        r.headerBtns.brightness,
        r.headerBtns.volume,
        r.headerBtns.refresh,
        r.headerBtns.visibility
      );
      this.panel.appendChild(r.header);
      r.body = el("div", { class: "vc-body" });
      this.panel.appendChild(r.body);
      const blocks = r.blocks;
      r.brightnessRow = el("div", { class: "vc-row is-collapsed", dataset: { block: "brightness" } });
      r.brightnessInput = el("input", {
        type: "range",
        min: "0.1",
        max: "2",
        step: "0.05",
        value: "1"
      });
      r.brightnessVal = el("span", { class: "vc-val", text: "100%" });
      r.brightnessInput.addEventListener("input", () => {
        const v = Number(r.brightnessInput.value);
        r.brightnessVal.textContent = `${Math.round(v * 100)}%`;
        this.onAction("brightness", v);
      });
      r.brightnessInput.addEventListener("change", () => {
        this.onAction("brightness-commit", Number(r.brightnessInput.value));
      });
      r.brightnessRow.append(
        el("label", { text: "亮度" }),
        r.brightnessInput,
        r.brightnessVal,
        el("button", {
          class: "vc-btn",
          text: "重置",
          title: "恢复 100%",
          onClick: stop$1(() => this.onAction("brightness-reset"))
        })
      );
      blocks.brightness = r.brightnessRow;
      r.volumeRow = el("div", { class: "vc-row is-collapsed", dataset: { block: "volume" } });
      r.volumeInput = el("input", {
        type: "range",
        min: "0",
        max: "1",
        step: "0.05",
        value: "1"
      });
      r.volumeVal = el("span", { class: "vc-val", text: "100%" });
      r.volumeInput.addEventListener("input", () => {
        const v = Number(r.volumeInput.value);
        r.volumeVal.textContent = `${Math.round(v * 100)}%`;
        this.onAction("volume", v);
      });
      r.volumeInput.addEventListener("change", () => {
        this.onAction("volume-commit", Number(r.volumeInput.value));
      });
      r.muteBtn = el("button", {
        class: "vc-btn",
        text: "静音",
        onClick: stop$1(() => this.onAction("toggle-mute"))
      });
      r.volumeRow.append(
        el("label", { text: "音量" }),
        r.volumeInput,
        r.volumeVal,
        r.muteBtn
      );
      blocks.volume = r.volumeRow;
      r.timeRow = el("div", { class: "vc-time", dataset: { block: "progress" } });
      r.curTime = el("span", { class: "vc-cur", text: "00:00" });
      r.progress = el("input", {
        type: "range",
        min: "0",
        max: "1000",
        value: "0"
      });
      r.totalTime = el("span", { class: "vc-total", text: "/ 00:00" });
      r.progress.addEventListener("input", () => {
        this.onAction("progress", Number(r.progress.value) / 1e3);
      });
      r.timeRow.append(r.curTime, r.progress, r.totalTime);
      blocks.progress = r.timeRow;
      r.seeks = el("div", { class: "vc-chips vc-seeks", dataset: { block: "seeks" } });
      r.speeds = el("div", { class: "vc-chips vc-speeds", dataset: { block: "speeds" } });
      blocks.seeks = r.seeks;
      blocks.speeds = r.speeds;
      r.playBtn = el("button", {
        class: "vc-play",
        text: "播放",
        dataset: { block: "play" },
        onClick: stop$1(() => this.onAction("toggle-play"))
      });
      blocks.play = r.playBtn;
      r.body.append(
        blocks.progress,
        blocks.seeks,
        blocks.speeds,
        blocks.play,
        blocks.brightness,
        blocks.volume
      );
      r.seekTip = el("div", { class: "vc-seek-tip" });
      document.body.appendChild(r.seekTip);
      this.floatBtn = el("button", {
        class: "vc-float is-hidden",
        id: "vc-float",
        text: "显示控制器",
        onClick: stop$1(() => this.onAction("toggle-visibility"))
      });
      document.body.append(this.panel, this.floatBtn);
      this.drag = new Draggable(this.panel, {
        getBounds: () => this.getBounds(),
        shouldIgnore: (target) => !!target?.closest?.(NO_DRAG_SELECTOR),
        onEnd: (pos) => this._saveDragPosition(pos)
      });
      this.drag.attach();
      this.setVisible(this.config.getVisible());
    }
    _saveDragPosition({ left, top }) {
      const b = this.getBounds();
      const rect = this.panel.getBoundingClientRect();
      const mode = this.config.getPosition().mode;
      if (mode === "absolute") {
        this.config.savePosition({ mode: "absolute", px: left, py: top });
      } else {
        const cx = left + rect.width / 2;
        const cy = top + rect.height / 2;
        this.config.savePosition({
          mode: "proportional",
          x: clamp$1(cx / Math.max(1, b.width), 0, 1),
          y: clamp$1(cy / Math.max(1, b.height), 0, 1)
        });
      }
    }
    // ---------- 配置应用：改 CSS 变量即可全量即时生效 ----------
    render(cfg) {
      if (!this.panel) return;
      const s = this.panel.style;
      s.setProperty("--vc-opacity", String(cfg.ui.opacity));
      s.setProperty("--vc-font", `${cfg.ui.fontSize}px`);
      s.setProperty("--vc-btn-font", `${cfg.ui.btnSize}px`);
      s.setProperty("--vc-panel-w", `${Math.max(176, cfg.ui.btnSize * 10 + 36)}px`);
      const w = Number(cfg.ui.panelWidth) || 0;
      const isVertical = cfg.layout === "vertical";
      s.setProperty(
        "--vc-user-w",
        w > 0 ? `${w}px` : isVertical ? "var(--vc-panel-w)" : "auto"
      );
      s.setProperty("--vc-min-w", w > 0 ? "0px" : "min(320px, calc(100vw - 16px))");
      const h = Number(cfg.ui.panelHeight) || 0;
      s.setProperty("--vc-user-h", h > 0 ? `${h}px` : "auto");
      this.panel.classList.toggle("vc-panel--vertical", cfg.layout === "vertical");
      this.refs.seeks.replaceChildren(
        ...cfg.seeks.map(
          (sec) => el("button", {
            class: "vc-btn",
            text: formatSeekLabel(sec),
            title: `${sec > 0 ? "快进" : "快退"} ${Math.abs(sec)} 秒`,
            onClick: stop$1(() => this.onAction("seek", sec))
          })
        )
      );
      const minus = el("button", {
        class: "vc-btn",
        text: "−",
        title: `减少倍速 ${cfg.speedStep}x`,
        onClick: stop$1(() => this.onAction("speed-adjust", -1))
      });
      const plus = el("button", {
        class: "vc-btn",
        text: "+",
        title: `增加倍速 ${cfg.speedStep}x`,
        onClick: stop$1(() => this.onAction("speed-adjust", 1))
      });
      this.refs.speedVal = el("span", { class: "vc-speedval", text: "1x" });
      const adj = el("div", { class: "vc-speedadj" }, [
        minus,
        this.refs.speedVal,
        plus
      ]);
      const presets = cfg.speeds.map(
        (sp) => el("button", {
          class: "vc-btn",
          text: `${sp}x`,
          dataset: { speed: String(sp) },
          onClick: stop$1(() => this.onAction("speed", sp))
        })
      );
      this.refs.speeds.replaceChildren(adj, ...presets);
    }
    // ---------- 定位 ----------
    applyPosition() {
      if (!this.panel) return;
      const b = this.getBounds();
      const rect = this.panel.getBoundingClientRect();
      const pos = this.config.getPosition();
      let left, top;
      if (pos.mode === "absolute") {
        left = pos.px;
        top = pos.py;
      } else {
        left = b.width * pos.x - rect.width / 2;
        top = b.height * pos.y - rect.height / 2;
      }
      const maxLeft = Math.max(0, b.width - rect.width);
      const maxTop = Math.max(0, b.height - rect.height);
      this.panel.style.left = `${clamp$1(left, Math.min(4, maxLeft), maxLeft)}px`;
      this.panel.style.top = `${clamp$1(top, Math.min(4, maxTop), maxTop)}px`;
    }
    // ---------- 状态同步 ----------
    syncFromVideo(video, cfg) {
      if (!video || !this.panel) return;
      this.updateTime(video.currentTime, video.duration);
      this.setPlayState(video.paused);
      this.setSpeed(video.playbackRate);
      if (cfg) {
        this.refs.brightnessInput.value = String(cfg.ui.brightness);
        this.refs.brightnessVal.textContent = `${Math.round(cfg.ui.brightness * 100)}%`;
        this.refs.volumeInput.value = String(cfg.ui.volume);
        this.refs.volumeVal.textContent = `${Math.round(cfg.ui.volume * 100)}%`;
        this.refs.muteBtn.textContent = video.muted ? "恢复" : "静音";
      }
    }
    updateTime(cur, total) {
      if (!this.panel) return;
      this.refs.curTime.textContent = formatTime(cur);
      this.refs.totalTime.textContent = `/ ${formatTime(total)}`;
      if (Number.isFinite(total) && total > 0) {
        this.refs.progress.value = String(
          Math.round(clamp$1(cur / total * 1e3, 0, 1e3))
        );
      }
    }
    setPlayState(paused) {
      if (!this.panel) return;
      this.refs.playBtn.textContent = paused ? "播放" : "暂停";
      this.refs.playBtn.classList.toggle("is-pause", !paused);
    }
    setSpeed(rate) {
      if (!this.panel) return;
      if (this.refs.speedVal) {
        this.refs.speedVal.textContent = `${parseFloat(Number(rate).toFixed(2))}x`;
      }
      this.refs.speeds.querySelectorAll("[data-speed]").forEach((btn) => {
        const active = Math.abs(Number(btn.dataset.speed) - rate) < 5e-3;
        btn.classList.toggle("is-active", active);
      });
    }
    setMuted(muted) {
      if (this.panel) this.refs.muteBtn.textContent = muted ? "恢复" : "静音";
    }
    showSeek(total) {
      if (!this.panel || !this.visible) return;
      this.seekTotal += total;
      const tip = this.refs.seekTip;
      const rect = this.panel.getBoundingClientRect();
      tip.textContent = formatSeek(this.seekTotal);
      tip.style.left = `${rect.left + rect.width / 2}px`;
      tip.style.top = `${Math.max(6, rect.top - 34)}px`;
      tip.classList.add("is-show");
      clearTimeout(this.seekTimer);
      this.seekTimer = setTimeout(() => {
        tip?.classList.remove("is-show");
        this.seekTotal = 0;
      }, 1500);
    }
    setCollapsed(which, collapsed) {
      const row = which === "brightness" ? this.refs.brightnessRow : this.refs.volumeRow;
      row?.classList.toggle("is-collapsed", collapsed);
    }
    isCollapsed(which) {
      const row = which === "brightness" ? this.refs.brightnessRow : this.refs.volumeRow;
      return row ? row.classList.contains("is-collapsed") : true;
    }
    setVisible(v) {
      this.visible = v;
      if (this.panel) this.panel.classList.toggle("is-hidden", !v);
      if (this.floatBtn) this.floatBtn.classList.toggle("is-hidden", v);
    }
    toggleVisibility() {
      this.setVisible(!this.visible);
      this.config.saveVisible(this.visible);
      return this.visible;
    }
    getElement() {
      return this.panel;
    }
    destroy() {
      clearTimeout(this.seekTimer);
      this.drag?.destroy();
      this.panel?.remove();
      this.floatBtn?.remove();
      this.refs.seekTip?.remove();
      this.panel = null;
      this.floatBtn = null;
      this.drag = null;
      this.refs = { blocks: {}, headerBtns: {} };
    }
  }
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn(e);
  };
  function rangeField(label, rule, value, fmt = (v) => String(v)) {
    const input = el("input", {
      type: "range",
      min: String(rule.min),
      max: String(rule.max),
      step: String(rule.step),
      value: String(value)
    });
    const val = el("span", { class: "vc-val", text: fmt(value) });
    input.addEventListener("input", () => val.textContent = fmt(Number(input.value)));
    const row = el("div", { class: "vc-field" }, [
      el("label", { text: label }),
      input,
      val
    ]);
    return { row, input, val };
  }
  function numberField(label, { min, max, step, value, hint }) {
    const input = el("input", {
      type: "number",
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value)
    });
    const row = el("div", { class: "vc-field" }, [
      el("label", { text: label }),
      input,
      el("span", { class: "vc-hint", text: hint })
    ]);
    return { row, input };
  }
  function chipsEditor({ values, format, parse, validate, onChange }) {
    let arr = [...values];
    const list = el("div", { class: "vc-editor" });
    const input = el("input", { type: "text", placeholder: "输入数值" });
    const note = el("div", { class: "vc-editor-note" });
    const swap = (i, j) => {
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      render();
      onChange(arr);
    };
    const render = () => {
      list.replaceChildren(
        ...arr.map(
          (v, i) => el("span", { class: "vc-chip" }, [
            el("button", {
              class: "vc-chip-move",
              text: "↑",
              title: "往前挪一位",
              disabled: i === 0,
              onClick: stop(() => swap(i, i - 1))
            }),
            el("span", { text: format(v) }),
            el("button", {
              class: "vc-chip-move",
              text: "↓",
              title: "往后挪一位",
              disabled: i === arr.length - 1,
              onClick: stop(() => swap(i, i + 1))
            }),
            el("button", {
              class: "vc-chip-del",
              text: "×",
              title: "删除该档位",
              onClick: stop(() => {
                arr.splice(i, 1);
                render();
                onChange(arr);
              })
            })
          ])
        ),
        el("div", { class: "vc-chip-add" }, [
          input,
          el("button", {
            class: "vc-btn",
            text: "添加",
            onClick: stop(() => {
              const v = parse(input.value);
              const err = validate(v, arr);
              if (err) {
                note.textContent = err;
                return;
              }
              note.textContent = "";
              arr.push(v);
              input.value = "";
              render();
              onChange(arr);
            })
          })
        ])
      );
    };
    render();
    return { node: el("div", {}, [list, note]), getValues: () => [...arr] };
  }
  class SettingsDialog {
    constructor({ config, onSaved, onInit, initialized }) {
      this.config = config;
      this.onSaved = onSaved;
      this.onInit = onInit;
      this.initialized = initialized;
      this.overlay = null;
      this.keyHandler = null;
    }
    isOpen() {
      return !!this.overlay;
    }
    open() {
      if (this.overlay) return;
      const cfg = this.config.get();
      const scope = this.config.scope;
      const ref = {};
      const scopeRadio = (value, label) => el("label", {}, [
        el("input", {
          type: "radio",
          name: "vc-scope",
          value,
          checked: scope === value
        }),
        label
      ]);
      const scopeBar = el("div", { class: "vc-scope" }, [
        el("span", { text: "配置作用域：" }),
        scopeRadio("global", "全局默认"),
        scopeRadio("site", "仅当前站点"),
        el("span", { class: "vc-tag", text: `站点 ${this.config.host}` })
      ]);
      const initBox = el("div", { class: "vc-section vc-init-box" }, [
        el("h4", { text: "⟳ 初始化配置" }),
        el("div", { class: "vc-init-meta" }, [
          el("span", { text: "初始化标识" }),
          el("code", { text: `INIT.VERSION = ${INIT.VERSION}` }),
          el("code", { text: `INIT.FORCE = ${INIT.FORCE}` }),
          el("span", {
            text: this.initialized ? "本次加载已强制应用出厂默认" : "当前使用本地配置"
          })
        ]),
        el("div", { class: "vc-editor-note", text: "在脚本头部修改 INIT.DEFAULTS 后把 VERSION +1，下次加载自动生效；此按钮可立即手动重新应用。" }),
        el("div", { style: "margin-top:10px" }, [
          el("button", {
            class: "vc-btn-lg vc-btn-warn",
            text: "恢复初始配置",
            title: "用脚本头部的 DEFAULTS 覆盖本地配置",
            onClick: stop(() => {
              const ok = window.confirm(
                "确定恢复初始配置吗？\n\n将清空：全部全局设置、所有站点的独立记忆、面板位置与显隐状态。\n此操作不可撤销，建议先导出配置备份。"
              );
              if (!ok) return;
              this.config.applyInitial();
              showToast("✓ 已恢复初始配置");
              this.onInit();
              this.close();
            })
          })
        ])
      ]);
      ref.opacity = rangeField("面板透明度", VALIDATORS["ui.opacity"], cfg.ui.opacity, (v) => `${Math.round(v * 100)}%`);
      ref.fontSize = rangeField("字体大小", VALIDATORS["ui.fontSize"], cfg.ui.fontSize, (v) => `${v}px`);
      ref.btnSize = rangeField("按钮大小", VALIDATORS["ui.btnSize"], cfg.ui.btnSize, (v) => `${v}px`);
      ref.brightness = rangeField("视频亮度", VALIDATORS["ui.brightness"], cfg.ui.brightness, (v) => `${Math.round(v * 100)}%`);
      ref.volume = rangeField("视频音量", VALIDATORS["ui.volume"], cfg.ui.volume, (v) => `${Math.round(v * 100)}%`);
      ref.panelW = numberField("面板宽度", { min: 0, max: 2e3, step: 10, value: cfg.ui.panelWidth, hint: "px，0 = 自适应" });
      ref.panelH = numberField("面板高度", { min: 0, max: 2e3, step: 10, value: cfg.ui.panelHeight, hint: "px，0 = 自适应" });
      const uiSection = el("div", { class: "vc-section" }, [
        el("h4", { text: "🎨 界面与画面" }),
        ref.opacity.row,
        ref.fontSize.row,
        ref.btnSize.row,
        ref.panelW.row,
        ref.panelH.row,
        ref.brightness.row,
        ref.volume.row,
        el("div", { class: "vc-editor-note", text: "面板尺寸始终受屏幕边界约束，移动端超出视口时会自动收窄。" })
      ]);
      ref.speeds = chipsEditor({
        values: cfg.speeds,
        format: (v) => `${v}x`,
        parse: (s) => parseFloat(String(s).replace(/x$/i, "")),
        validate: (v, arr) => {
          if (!Number.isFinite(v)) return "请输入有效数字，例如 1.5";
          if (v < SPEED_MIN || v > SPEED_MAX) return `倍速需在 ${SPEED_MIN} ~ ${SPEED_MAX} 之间`;
          if (arr.some((x) => Math.abs(x - v) < 1e-3)) return "该档位已存在";
          return "";
        },
        onChange: () => {
        }
      });
      ref.seeks = chipsEditor({
        values: cfg.seeks,
        format: formatSeekLabel,
        parse: (s) => parseInt(String(s).trim(), 10),
        validate: (v, arr) => {
          if (!Number.isFinite(v)) return "请输入整数秒数，例如 -30 或 300";
          if (v === 0) return "0 秒没有意义";
          if (v < SEEK_MIN || v > SEEK_MAX) return `范围需在 ${SEEK_MIN} ~ ${SEEK_MAX} 秒`;
          if (arr.includes(v)) return "该档位已存在";
          return "";
        },
        onChange: () => {
        }
      });
      ref.speedStep = rangeField("倍速步进", VALIDATORS.speedStep, cfg.speedStep, (v) => `${v}x`);
      const speedSection = el("div", { class: "vc-section" }, [
        el("h4", { text: "🎬 倍速与快进档位" }),
        el("div", { class: "vc-field" }, [el("label", { text: "倍速档位" })]),
        ref.speeds.node,
        el("div", { class: "vc-field" }, [el("label", { text: "快进档位" })]),
        ref.seeks.node,
        el("div", { class: "vc-editor-note", text: "用 ↑ ↓ 调整显示顺序，× 删除；保存后面板立即按新顺序重建。快进档位填秒数，负数表示快退，例如 -30 / 300。" }),
        ref.speedStep.row
      ]);
      ref.layout = el("select", {}, [
        el("option", { value: "auto", text: "自动（窄屏竖排 / 宽屏横排）", selected: cfg.layout === "auto" }),
        el("option", { value: "horizontal", text: "强制水平面板", selected: cfg.layout === "horizontal" }),
        el("option", { value: "vertical", text: "强制垂直面板", selected: cfg.layout === "vertical" })
      ]);
      ref.shortcuts = el("input", { type: "checkbox", checked: !!cfg.shortcuts });
      const pos = this.config.getPosition();
      ref.posMode = el("select", {}, [
        el("option", { value: "proportional", text: "相对位置（比例）", selected: pos.mode === "proportional" }),
        el("option", { value: "absolute", text: "绝对位置（像素）", selected: pos.mode === "absolute" })
      ]);
      ref.posX = el("input", { type: "number", min: "0", max: "1", step: "0.01", value: String(pos.mode === "proportional" ? pos.x : 0.5) });
      ref.posY = el("input", { type: "number", min: "0", max: "1", step: "0.01", value: String(pos.mode === "proportional" ? pos.y : 0.5) });
      const miscSection = el("div", { class: "vc-section" }, [
        el("h4", { text: "📌 布局、定位与快捷键" }),
        el("div", { class: "vc-field" }, [el("label", { text: "面板布局" }), ref.layout]),
        el("div", { class: "vc-editor-note", text: "选「自动」时窄屏或触摸设备自动竖排，宽屏自动横排；选「强制」后不再跟随屏幕变化，面板上的 ↕ 按钮就是在两个方向间切换。" }),
        el("div", { class: "vc-field" }, [el("label", { text: "定位方式" }), ref.posMode, el("span", { class: "vc-hint", text: "全局生效" })]),
        el("div", { class: "vc-field" }, [el("label", { text: "水平 / 垂直" }), ref.posX, ref.posY, el("span", { class: "vc-hint", text: "0~1 比例" })]),
        el("div", { class: "vc-field" }, [el("label", { text: "全局快捷键" }), ref.shortcuts]),
        el("table", { class: "vc-kbd-table" }, [
          el("tr", {}, [el("td", { text: "空格 / K" }), el("td", { text: "播放 / 暂停" })]),
          el("tr", {}, [el("td", { text: "← / →" }), el("td", { text: "快退 / 快进 10 秒" })]),
          el("tr", {}, [el("td", { text: "↑ / ↓" }), el("td", { text: "音量 ±5%" })]),
          el("tr", {}, [el("td", { text: "[ / ]" }), el("td", { text: "倍速 −/+" })]),
          el("tr", {}, [el("td", { text: "1 ~ 9" }), el("td", { text: "切换到第 N 个倍速档位" })]),
          el("tr", {}, [el("td", { text: "M / F / H" }), el("td", { text: "静音 / 全屏 / 隐藏面板" })]),
          el("tr", {}, [el("td", { text: "Shift + ←/→" }), el("td", { text: "快退 / 快进 60 秒" })])
        ])
      ]);
      ref.ioText = el("textarea", { placeholder: "点「导出」生成配置 JSON，或粘贴配置后点「导入」" });
      const ioSection = el("div", { class: "vc-section" }, [
        el("h4", { text: "📦 配置导入 / 导出" }),
        el("div", { class: "vc-io-row" }, [
          el("button", {
            class: "vc-btn-lg vc-btn-plain",
            text: "导出配置",
            onClick: stop(() => {
              ref.ioText.value = this.config.exportConfig();
              ref.ioText.select();
              showToast("✓ 已生成配置，可复制保存");
            })
          }),
          el("button", {
            class: "vc-btn-lg vc-btn-plain",
            text: "复制到剪贴板",
            onClick: stop(async () => {
              if (!ref.ioText.value) ref.ioText.value = this.config.exportConfig();
              try {
                await navigator.clipboard.writeText(ref.ioText.value);
                showToast("✓ 已复制");
              } catch (e) {
                ref.ioText.select();
                showToast("请按 Ctrl+C 复制", true);
              }
            })
          }),
          el("button", {
            class: "vc-btn-lg vc-btn-ghost",
            text: "导入配置",
            onClick: stop(() => {
              try {
                this.config.importConfig(ref.ioText.value);
                showToast("✓ 配置已导入");
                this.onSaved();
                this.close();
              } catch (e) {
                showToast(`导入失败：${e.message || "格式错误"}`, true);
              }
            })
          })
        ]),
        ref.ioText
      ]);
      const save = el("button", { class: "vc-btn-lg vc-btn-primary", text: "保存配置" });
      const cancel = el("button", { class: "vc-btn-lg vc-btn-plain", text: "取消" });
      const clearScope = el("button", {
        class: "vc-btn-lg vc-btn-ghost",
        text: "清除本作用域差异",
        title: "删除当前作用域保存的修改，回落到上层配置",
        onClick: stop(() => {
          this.config.clearScope(this._scope());
          showToast("✓ 已清除本作用域差异");
          this.onSaved();
          this.close();
        })
      });
      const actions = el("div", { class: "vc-actions" }, [
        clearScope,
        el("div", { class: "vc-right" }, [cancel, save])
      ]);
      const dialog = el("div", { class: "vc-dialog" }, [
        el("div", { class: "vc-dialog-head" }, [
          el("h3", { text: "⚙️ 参数设置" }),
          el("button", { class: "vc-btn vc-btn--icon", text: "×", title: "关闭 (ESC)", onClick: stop(() => this.close()) })
        ]),
        scopeBar,
        initBox,
        uiSection,
        speedSection,
        miscSection,
        ioSection,
        actions
      ]);
      this.overlay = el("div", { class: "vc-overlay", id: "vc-overlay" }, [dialog]);
      this.overlay.addEventListener("click", (e) => {
        if (e.target === this.overlay) this.close();
      });
      const doSave = () => {
        const num = (f, rule, fallback) => {
          const v = Number(f.input.value);
          return Number.isFinite(v) ? clamp$1(v, rule.min, rule.max) : fallback;
        };
        const patch = {
          speeds: ref.speeds.getValues(),
          seeks: ref.seeks.getValues(),
          speedStep: num(ref.speedStep, VALIDATORS.speedStep, cfg.speedStep),
          ui: {
            opacity: num(ref.opacity, VALIDATORS["ui.opacity"], cfg.ui.opacity),
            fontSize: num(ref.fontSize, VALIDATORS["ui.fontSize"], cfg.ui.fontSize),
            btnSize: num(ref.btnSize, VALIDATORS["ui.btnSize"], cfg.ui.btnSize),
            brightness: num(ref.brightness, VALIDATORS["ui.brightness"], cfg.ui.brightness),
            volume: num(ref.volume, VALIDATORS["ui.volume"], cfg.ui.volume),
            panelWidth: clamp$1(Number(ref.panelW.input.value) || 0, 0, 2e3),
            panelHeight: clamp$1(Number(ref.panelH.input.value) || 0, 0, 2e3)
          },
          layout: ref.layout.value,
          shortcuts: ref.shortcuts.checked
        };
        this.config.scope = this._scope();
        this.config.save(patch, this._scope());
        this.config.savePosition({
          mode: ref.posMode.value,
          x: clamp$1(Number(ref.posX.value) || 0.5, 0, 1),
          y: clamp$1(Number(ref.posY.value) || 0.5, 0, 1),
          px: 10,
          py: 10
        });
        showToast("✓ 配置已保存并生效");
        this.onSaved();
        this.close();
      };
      save.addEventListener("click", stop(doSave));
      cancel.addEventListener("click", stop(() => this.close()));
      this.keyHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          this.close();
        } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          doSave();
        }
      };
      document.addEventListener("keydown", this.keyHandler);
      document.body.appendChild(this.overlay);
      setTimeout(() => dialog.querySelector("input")?.focus(), 60);
    }
    _scope() {
      const checked = this.overlay?.querySelector('input[name="vc-scope"]:checked');
      return checked ? checked.value : "global";
    }
    close() {
      if (this.keyHandler) {
        document.removeEventListener("keydown", this.keyHandler);
        this.keyHandler = null;
      }
      this.overlay?.remove();
      this.overlay = null;
    }
    destroy() {
      this.close();
    }
  }
  class FullscreenManager {
    constructor({ getVideo, getPanel, onReposition }) {
      this.getVideo = getVideo;
      this.getPanel = getPanel;
      this.onReposition = onReposition;
      this.container = null;
      this._onFsChange = () => this.check();
    }
    start() {
      document.addEventListener("fullscreenchange", this._onFsChange);
      document.addEventListener("webkitfullscreenchange", this._onFsChange);
    }
    stop() {
      document.removeEventListener("fullscreenchange", this._onFsChange);
      document.removeEventListener("webkitfullscreenchange", this._onFsChange);
    }
    // 拖拽/定位的坐标参照系：全屏时用容器矩形，否则用视口
    getBounds() {
      if (this.container && this.container !== document.body) {
        const r = this.container.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      }
      return {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight
      };
    }
    isActive() {
      return !!this.container && this.container !== document.body;
    }
    _detectCssContainer(video) {
      const stop2 = video.ownerDocument?.body || document.body;
      let node = video.parentElement;
      while (node && node !== stop2 && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        if ((style.position === "fixed" || style.position === "absolute") && node.offsetWidth >= window.innerWidth * 0.9 && node.offsetHeight >= window.innerHeight * 0.9) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }
    _resolveTarget() {
      const fs = document.fullscreenElement || document.webkitFullscreenElement || null;
      if (fs) return fs;
      const video = this.getVideo();
      return video ? this._detectCssContainer(video) : null;
    }
    check() {
      const panel = this.getPanel();
      if (!panel) return;
      const target = this._resolveTarget();
      const desired = target || document.body;
      if (this.container !== desired) {
        desired.appendChild(panel);
        this.container = desired;
        if (this.isActive()) {
          panel.classList.add("vc-panel--embedded");
        } else {
          panel.classList.remove("vc-panel--embedded");
        }
      }
      this.onReposition();
    }
    // 视频切换 / 脚本销毁时调用，清空挂载状态
    reset() {
      this.container = null;
    }
  }
  class VideoController {
    constructor(video, onEvent) {
      this.video = video;
      this.onEvent = onEvent;
      this._handlers = [];
      this._originalFilter = video?.style?.filter || "";
    }
    _on(type, fn) {
      this.video.addEventListener(type, fn);
      this._handlers.push([type, fn]);
    }
    attach() {
      if (!this.video) return;
      this.video;
      this._on("loadedmetadata", () => this.onEvent("loaded"));
      this._on("durationchange", () => this.onEvent("time"));
      this._on("timeupdate", () => this.onEvent("time"));
      this._on("play", () => this.onEvent("play"));
      this._on("pause", () => this.onEvent("play"));
      this._on("ratechange", () => this.onEvent("rate"));
      this._on("volumechange", () => this.onEvent("mute"));
    }
    destroy() {
      for (const [type, fn] of this._handlers) {
        this.video?.removeEventListener(type, fn);
      }
      this._handlers = [];
    }
    togglePlay() {
      const v = this.video;
      if (!v) return;
      if (v.paused) {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {
        });
      } else {
        v.pause();
      }
    }
    seek(seconds) {
      const v = this.video;
      if (!v) return;
      const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
      v.currentTime = clamp$1(v.currentTime + seconds, 0, Math.max(0, dur - 0.1));
    }
    setProgress(ratio) {
      const v = this.video;
      if (v && Number.isFinite(v.duration) && v.duration > 0) {
        v.currentTime = clamp$1(ratio, 0, 1) * v.duration;
      }
    }
    setSpeed(rate) {
      if (this.video) this.video.playbackRate = clamp$1(rate, SPEED_MIN, SPEED_MAX);
    }
    adjustSpeed(dir, step) {
      if (!this.video) return;
      const next = this.video.playbackRate + dir * step;
      this.video.playbackRate = clamp$1(
        Math.round(next * 100) / 100,
        SPEED_MIN,
        SPEED_MAX
      );
    }
    setBrightness(value) {
      const v = this.video;
      if (!v) return;
      v.style.filter = Math.abs(value - 1) < 1e-3 ? this._originalFilter : `brightness(${value})`;
    }
    setVolume(value) {
      const v = this.video;
      if (!v) return;
      v.volume = clamp$1(value, 0, 1);
      if (v.muted && value > 0) v.muted = false;
    }
    adjustVolume(delta) {
      if (this.video) this.setVolume(this.video.volume + delta);
    }
    toggleMute() {
      if (this.video) this.video.muted = !this.video.muted;
    }
    // 视频绑定时应用该站点生效的亮度/音量（默认值不动网站原有设置）
    applyMedia(cfg) {
      if (!this.video || !cfg) return;
      if (cfg.ui.volume !== 1) this.video.volume = clamp$1(cfg.ui.volume, 0, 1);
      if (cfg.ui.brightness !== 1) this.setBrightness(cfg.ui.brightness);
    }
    toggleFullscreen() {
      const v = this.video;
      if (!v) return;
      const doc = v.ownerDocument || document;
      const current = doc.fullscreenElement || doc.webkitFullscreenElement;
      if (current) {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (exit) exit.call(doc).catch?.(() => {
        });
        return;
      }
      const target = v.parentElement || v;
      const req = target.requestFullscreen || target.webkitRequestFullscreen || v.requestFullscreen || v.webkitRequestFullscreen;
      if (req) {
        const p = req.call(target);
        if (p && typeof p.catch === "function") p.catch(() => {
        });
      }
    }
  }
  class Shortcuts {
    constructor({ config, actions, isBlocked }) {
      this.config = config;
      this.actions = actions;
      this.isBlocked = isBlocked;
      this._handler = (e) => this._dispatch(e);
    }
    start() {
      document.addEventListener("keydown", this._handler);
    }
    stop() {
      document.removeEventListener("keydown", this._handler);
    }
    _dispatch(e) {
      if (this.isBlocked?.() || isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!this.config.get().shortcuts) return;
      const k = e.key;
      let handled = true;
      switch (k) {
        case " ":
        case "k":
        case "K":
          this.actions.togglePlay();
          break;
        case "ArrowLeft":
          this.actions.seek(e.shiftKey ? -60 : -10);
          break;
        case "ArrowRight":
          this.actions.seek(e.shiftKey ? 60 : 10);
          break;
        case "ArrowUp":
          this.actions.adjustVolume(0.05);
          break;
        case "ArrowDown":
          this.actions.adjustVolume(-0.05);
          break;
        case "[":
          this.actions.adjustSpeed(-1);
          break;
        case "]":
          this.actions.adjustSpeed(1);
          break;
        case "m":
        case "M":
          this.actions.toggleMute();
          break;
        case "f":
        case "F":
          this.actions.toggleFullscreen();
          break;
        case "h":
        case "H":
          this.actions.toggleVisibility();
          break;
        default:
          if (/^[1-9]$/.test(k)) {
            this.actions.setSpeedIndex(Number(k) - 1);
          } else {
            handled = false;
          }
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }
  function speedAt(cfg, index) {
    const list = cfg.speeds;
    return list[clamp$1(index, 0, list.length - 1)];
  }
  const INIT_DELAY = 600;
  class App {
    constructor() {
      this.config = new ConfigManager();
      this.initialized = this.config.load();
      injectStyles();
      this.video = null;
      this.controller = null;
      this.cfg = this.config.get();
      this._rawLayout = this.cfg.layout;
      this._applyResponsiveLayout();
      this.fullscreen = new FullscreenManager({
        getVideo: () => this.video,
        getPanel: () => this.panel?.getElement(),
        onReposition: () => this.panel?.applyPosition()
      });
      this.panel = new Panel({
        config: this.config,
        onAction: (name, value) => this.onAction(name, value),
        getBounds: () => this.fullscreen.getBounds()
      });
      this.settings = new SettingsDialog({
        config: this.config,
        initialized: this.initialized,
        onSaved: () => this.onConfigChanged(),
        onInit: () => {
          this.onConfigChanged();
          this.panel.setVisible(this.config.getVisible());
          this.panel.applyPosition();
        }
      });
      this.shortcuts = new Shortcuts({
        config: this.config,
        isBlocked: () => this.settings.isOpen(),
        actions: {
          togglePlay: () => this.controller?.togglePlay(),
          seek: (s) => {
            if (!this.controller) return;
            this.controller.seek(s);
            this.panel.showSeek(s);
          },
          adjustVolume: (d) => this.controller?.adjustVolume(d),
          adjustSpeed: (d) => this.controller?.adjustSpeed(d, this.cfg.speedStep),
          setSpeedIndex: (i) => this.controller?.setSpeed(speedAt(this.cfg, i)),
          toggleMute: () => this.controller?.toggleMute(),
          toggleFullscreen: () => this.controller?.toggleFullscreen(),
          toggleVisibility: () => this.panel.toggleVisibility()
        }
      });
    }
    // ---------- 启动 / 销毁 ----------
    start() {
      this.panel.mount();
      this.panel.render(this.cfg);
      this.fullscreen.start();
      this.shortcuts.start();
      this._onResize = throttle(() => {
        const prev = this.cfg.layout;
        this._applyResponsiveLayout();
        if (prev !== this.cfg.layout) this.panel.render(this.cfg);
        this.panel.applyPosition();
        this.fullscreen.check();
      }, 150);
      window.addEventListener("resize", this._onResize);
      this._onUnload = () => this.destroy();
      window.addEventListener("beforeunload", this._onUnload);
      this.observer = new MutationObserver(throttle(() => this.onDomChange(), 200));
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"]
      });
      this._tryBind();
      this.panel.applyPosition();
      if (this.initialized) {
        showToast("✓ 已应用脚本初始配置（INIT.VERSION 变更）");
      }
    }
    destroy() {
      this.observer?.disconnect();
      this.controller?.destroy();
      this.panel?.destroy();
      this.settings?.destroy();
      this.fullscreen?.stop();
      this.shortcuts?.stop();
      if (this._onResize) window.removeEventListener("resize", this._onResize);
      if (this._onUnload) window.removeEventListener("beforeunload", this._onUnload);
    }
    _tryBind() {
      const v = findVideo();
      if (v) this.bindVideo(v);
    }
    bindVideo(video) {
      this.controller?.destroy();
      this.video = video;
      this.controller = new VideoController(video, (type) => this.onEvent(type));
      this.controller.attach();
      this.controller.applyMedia(this.cfg);
      this.panel.syncFromVideo(video, this.cfg);
      this.fullscreen.reset();
      this.fullscreen.check();
      logger.log("已绑定视频", (video.currentSrc || "").slice(0, 60));
    }
    onDomChange() {
      if (!this.video || !this.video.isConnected) {
        const v = findVideo();
        if (v && v !== this.video) this.bindVideo(v);
      }
      this.fullscreen.check();
    }
    // ---------- 视频事件 → 面板 ----------
    onEvent(type) {
      const v = this.video;
      if (!v) return;
      switch (type) {
        case "time":
          this.panel.updateTime(v.currentTime, v.duration);
          break;
        case "loaded":
          this.panel.updateTime(v.currentTime, v.duration);
          this.panel.setSpeed(v.playbackRate);
          break;
        case "play":
          this.panel.setPlayState(v.paused);
          break;
        case "rate":
          this.panel.setSpeed(v.playbackRate);
          break;
        case "mute":
          this.panel.setMuted(v.muted);
          break;
      }
    }
    // ---------- 配置变化：重新渲染并全量应用 ----------
    onConfigChanged() {
      this.cfg = this.config.get();
      this._rawLayout = this.cfg.layout;
      this._applyResponsiveLayout();
      this.panel.render(this.cfg);
      this.panel.syncFromVideo(this.video, this.cfg);
      this.controller?.applyMedia(this.cfg);
      this.panel.applyPosition();
    }
    // 只有配置为 auto 时才跟随屏幕；显式指定过方向就完全尊重用户选择。
    // 旧版用"层里有没有 layout 键"判断，导致把方向改回默认时被判成"没设过"，
    // 于是被自动逻辑抢回 vertical —— 竖着切不回横向就是这么来的。
    _applyResponsiveLayout() {
      if (this._rawLayout !== "auto") {
        this.cfg.layout = this._rawLayout;
        return;
      }
      const narrow = window.innerWidth <= MOBILE_BREAKPOINT;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      this.cfg.layout = narrow || coarse && window.innerWidth < 1024 ? "vertical" : "horizontal";
    }
    // ---------- 面板交互统一分发 ----------
    onAction(name, value) {
      const c = this.controller;
      switch (name) {
        case "seek":
          if (c) {
            c.seek(value);
            this.panel.showSeek(value);
          }
          break;
        case "speed":
          c?.setSpeed(value);
          break;
        case "speed-adjust":
          c?.adjustSpeed(value, this.cfg.speedStep);
          break;
        case "toggle-play":
          c?.togglePlay();
          break;
        case "progress":
          c?.setProgress(value);
          break;
        case "brightness":
          c?.setBrightness(value);
          this.cfg.ui.brightness = value;
          break;
        case "brightness-commit":
          this.config.save({ ui: { brightness: value } }, this.config.scope);
          break;
        case "brightness-reset":
          c?.setBrightness(1);
          this.cfg.ui.brightness = 1;
          this.config.save({ ui: { brightness: 1 } }, this.config.scope);
          this.panel.syncFromVideo(this.video, this.cfg);
          break;
        case "volume":
          c?.setVolume(value);
          this.cfg.ui.volume = value;
          break;
        case "volume-commit":
          this.config.save({ ui: { volume: value } }, this.config.scope);
          break;
        case "toggle-mute":
          c?.toggleMute();
          break;
        case "toggle-brightness":
          this.panel.setCollapsed("brightness", !this.panel.isCollapsed("brightness"));
          break;
        case "toggle-volume":
          this.panel.setCollapsed("volume", !this.panel.isCollapsed("volume"));
          break;
        case "toggle-visibility":
          this.panel.toggleVisibility();
          break;
        case "toggle-layout": {
          const next = this.cfg.layout === "vertical" ? "horizontal" : "vertical";
          this.config.save({ layout: next }, this.config.scope);
          this.onConfigChanged();
          showToast(next === "vertical" ? "已切换为垂直布局" : "已切换为水平布局");
          break;
        }
        case "open-settings":
          this.settings.open();
          break;
        case "refresh": {
          const v = findVideo();
          if (v) {
            this.bindVideo(v);
            showToast("✓ 已重新绑定视频");
          } else {
            showToast("未找到可控制的视频", true);
          }
          break;
        }
      }
    }
  }
  function bootstrap() {
    if (window.__vc_app) return;
    const app = new App();
    window.__vc_app = app;
    app.start();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(bootstrap, INIT_DELAY));
  } else {
    setTimeout(bootstrap, INIT_DELAY);
  }
})();
