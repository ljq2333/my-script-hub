// ==UserScript==
// @name         视频播放控制器
// @namespace    http://tampermonkey.net/
// @version      0.9.10
// @description  可拖拽控制面板，快进/倍速按钮可增删改排序（横竖面板分别保存互不影响），竖版快退/快进上下方向可调，一键清空配置
// @author       You
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// @downloadURL  https://github.com/ljq2333/my-script-hub/raw/main/%E8%A7%86%E9%A2%91%E6%92%AD%E6%94%BE%E6%8E%A7%E5%88%B6%E5%99%A8.user.js
// @updateURL    https://github.com/ljq2333/my-script-hub/raw/main/%E8%A7%86%E9%A2%91%E6%92%AD%E6%94%BE%E6%8E%A7%E5%88%B6%E5%99%A8.user.js
// ==/UserScript==

(function () {
  "use strict";

  // ==================== 自定义配置（可随意修改） ====================
  const FONT_STACK =
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
  const PANEL_BASE = `position:fixed;z-index:99999;color:#fff;font-family:${FONT_STACK};cursor:move;user-select:none;display:flex;flex-direction:column;box-shadow:0 4px 20px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1)`;
  const CONFIG = {
    // 文字标签
    TEXT: {
      PLAY: "Play",
      PAUSE: "Pause",
      HIDE_PANEL: "Hide",
      SHOW_PANEL: "Show",
      SETTINGS_TITLE: "⚙️ 参数设置",
      UI_LABEL: "界面样式",
      SAVE: "保存配置",
      CANCEL: "取消",
      CLEAR: "清空配置",
      INIT: "初始化",
      SEEK_LABELS: {
        "-600": "-10m",
        "-60": "-1m",
        "-10": "-10s",
        10: "+10s",
        60: "+1m",
        600: "+10m",
      },
      BRIGHTNESS_BTN: "☀️",
      VOLUME_BTN: "🔊",
      REFRESH_BTN: "🔄",
      TOAST: {
        SAVED: "✓ 配置已保存",
        CLEARED: "✓ 已清空配置，已恢复脚本默认值",
        INIT_OK: "✓ 已重新初始化",
        INIT_FAIL: "未找到可控制的视频",
      },
    },
    // 默认配置
    DEFAULT_SPEEDS: [ 1.5, 1.25, 1.0],
    // 倍速 +/- 按钮的调整步进（可在设置中修改）
    DEFAULT_SPEED_STEP: 0.5,
    // 倍速调整范围
    SPEED_MIN: 0.1,
    SPEED_MAX: 16,
    // 快进/快退范围（秒）与列表项上限
    SEEK_MIN: -3600,
    SEEK_MAX: 3600,
    MAX_LIST_ITEMS: 12,
    DEFAULT_SEEKS: [-600, -60, -10, 10, 60, 600],
    // 垂直面板中快进/快退按钮的上下排列：backward=快退在前，forward=快进在前
    DEFAULT_SEEK_ORDER_V: "backward",
    // 面板功能区块固定顺序（横/竖面板各自独立）
    DEFAULT_ORDER_H: ["time", "seek", "speed", "play"],
    DEFAULT_ORDER_V: ["progress", "time", "speed", "seek", "play"],
    // 快进档位版本：新增 +5m 后 +1，用于让旧的本地存档回退到新默认值
    SEEKS_VERSION: 1,
    DEFAULT_UI: {
      opacity: 0.85,
      fontSize: 14,
      brightness: 1.0,
      volume: 1.0,
      btnSize: 14,
    },
    // 验证规则
    VALIDATORS: {
      opacity: { min: 0.3, max: 1, step: 0.05 },
      fontSize: { min: 12, max: 24, step: 1 },
      brightness: { min: 0.1, max: 2, step: 0.05 },
      volume: { min: 0, max: 1, step: 0.05 },
      btnSize: { min: 10, max: 22, step: 1 },
      speedStep: { min: 0.1, max: 5, step: 0.05 },
    },
    // 最小视频尺寸
    MIN_VIDEO_SIZE: 200,
    // 脚本标识前缀
    PREFIX: "VideoCtrl",
    // 延迟初始化（ms）
    INIT_DELAY: 800,
    // UI样式
    STYLE: {
      PANEL: PANEL_BASE + "background:rgba(0,0,0,.85);padding:12px;border-radius:10px;font-size:14px;gap:10px",
      PANEL_VERT: PANEL_BASE + "background:rgba(0,0,0,.85);padding:8px;border-radius:10px;font-size:14px;gap:6px;width:85px;align-items:center",
      FLOAT_BTN: "position:fixed;z-index:99998;right:15px;bottom:15px;padding:8px 16px;border:1px solid #555;border-radius:6px;background:#555;color:#fff;cursor:pointer;display:none",
      HEADER_ROW: "display:flex;justify-content:space-between;align-items:center;margin-bottom:-4px",
      SETTING_BTN: "background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:0 2px;line-height:1",
      HIDE_BTN: "padding:3px 10px;border:1px solid #666;border-radius:4px;background:#444;color:#ddd;cursor:pointer;font-size:12px",
      TIME_ROW: "display:flex;align-items:center;gap:8px;min-width:320px",
      CURRENT_TIME: "min-width:45px",
      TOTAL_TIME: "color:#aaa",
      PROGRESS: "flex:1;height:6px;cursor:pointer;accent-color:#4CAF50",
      SEEK_ROW: "display:flex;justify-content:center;gap:6px;flex-wrap:wrap",
      SEEK_BTN: "padding:4px 10px;border:1px solid #555;border-radius:5px;background:#2a2a2a;color:#fff;cursor:pointer;font-size:13px",
      SEEK_BTN_HOVER: "#444",
      ACTION_ROW: "display:flex;justify-content:flex-end;align-items:center;gap:6px;flex-wrap:wrap",
      SPEED_BTN: "padding:3px 8px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#fff;cursor:pointer;font-size:12px;min-width:36px",
      SPEED_BTN_ACTIVE: "#2196F3",
      PLAY_BTN: "padding:5px 14px;border:none;border-radius:5px;color:#fff;cursor:pointer;font-weight:500",
      PLAY_COLOR: "#28a745",
      PAUSE_COLOR: "#dc3545",
      SPEED_DISPLAY: "padding:3px 8px;border:1px solid #555;border-radius:4px;background:#111;color:#7ed6df;text-align:center;cursor:default;font-size:12px;min-width:36px",
      SPEED_BTN_VERT: "padding:4px 0;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#fff;cursor:pointer;text-align:center;flex-shrink:0;font-size:14px",
      SPEED_DISPLAY_VERT: "padding:4px 0;border:1px solid #555;border-radius:4px;background:#111;color:#7ed6df;cursor:default;text-align:center;flex-shrink:0;font-size:14px",
      SEEK_BTN_VERT: "padding:4px 0;border:1px solid #555;border-radius:5px;background:#2a2a2a;color:#fff;cursor:pointer;text-align:center;flex-shrink:0;font-size:14px",
      PLAY_BTN_VERT: "padding:8px 0;border:none;border-radius:5px;color:#fff;cursor:pointer;font-weight:500;width:100%;font-size:16px",
      VERT_COL: "display:flex;flex-direction:column;gap:3px;width:100%",
      SEEK_NOTICE: "position:absolute;top:-30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:4px 12px;border-radius:6px;z-index:999999;font-size:14px;opacity:0;transition:opacity .2s;white-space:nowrap",
      OVERLAY: "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:1000000;display:flex;justify-content:center;align-items:center",
      DIALOG: "background:#1a1a2e;color:#eee;padding:20px;border-radius:12px;min-width:420px;max-width:90vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,.6);border:1px solid #333",
      DIALOG_HEADER: "display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid #333",
      DIALOG_TITLE: "margin:0;font-size:18px;color:#fff",
      DIALOG_CLOSE: "background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;padding:0 5px",
      SECTION: "margin-bottom:18px;padding:12px;background:#252540;border-radius:8px",
      SECTION_TITLE: "margin:0 0 10px;font-size:15px;color:#7ed6df;display:flex;align-items:center;gap:6px",
      UI_ROW: "display:flex;align-items:center;gap:12px;margin:8px 0",
      UI_LABEL: "min-width:70px;color:#aaa;font-size:13px",
      UI_INPUT: "width:80px;padding:4px 8px;background:#222;border:1px solid #555;border-radius:4px;color:#fff;font-size:13px",
      UI_RANGE: "flex:1;accent-color:#3498db",
      ADD_BTN: "padding:5px 12px;background:#3498db;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:13px;margin-top:8px",
      ITEM_ROW: "display:flex;align-items:center;gap:6px",
      ITEM_INPUT: "width:90px;padding:4px 8px;background:#222;border:1px solid #555;border-radius:4px;color:#fff;font-size:13px",
      ITEM_PREVIEW: "min-width:56px;color:#888;font-size:12px",
      ITEM_MOVE: "padding:3px 8px;background:#3a3a55;border:none;border-radius:4px;color:#ddd;cursor:pointer;font-size:12px",
      ITEM_DEL: "padding:3px 8px;background:#c0392b;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px",
      BTN_ROW: "display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:15px;border-top:1px solid #333",
      BTN_GROUP: "display:flex;gap:8px",
      SAVE_BTN: "padding:8px 20px;background:#27ae60;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:500",
      SAVE_BTN_HOVER: "#219653",
      CANCEL_BTN: "padding:8px 20px;background:#555;border:none;border-radius:6px;color:#fff;cursor:pointer",
      CLEAR_BTN: "padding:8px 16px;background:#c0392b;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px",
      INIT_BTN: "padding:8px 16px;background:#8e44ad;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px",
      TOAST: "position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(39,174,96,.95);color:#fff;padding:10px 20px;border-radius:8px;z-index:1000001;font-size:14px;opacity:0;transition:opacity .3s;pointer-events:none",
      SLIDER_ROW: "display:flex;align-items:center;gap:8px;padding:6px 0",
      BRIGHTNESS_INPUT: "flex:1;height:6px;cursor:pointer;accent-color:#FFD700",
      BRIGHTNESS_VAL: "min-width:40px;text-align:right;color:#FFD700;font-size:13px",
      SLIDER_RESET: "padding:2px 8px;background:#555;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;line-height:1.4",
      VOLUME_INPUT: "flex:1;height:6px;cursor:pointer;accent-color:#3498db",
      VOLUME_VAL: "min-width:40px;text-align:right;color:#3498db;font-size:13px",
    },
  };

  const P = CONFIG.PREFIX;
  const L = (m) => console.log(`[${P}] ${m}`);

  // ==================== 全局状态 ====================
  let videoEl = null,
    controls = null,
    progress = null,
    curTime = null,
    totalTime = null,
    playBtn = null,
    floatBtn = null,
    speedDisplay = null,
    visible = true,
    lastPos = { x: "10px", y: "10px" },
    seekTimer = null,
    totalSeek = 0,
    observer = null,
    settingsOverlay = null,
    settingsKeyHandler = null,
    isVertical = false;
  let manualRefresh = false; // 防止手动刷新与 MutationObserver 冲突
  let isFullscreen = false;
  let originalParent = null;
  let fullscreenContainer = null;
  let fullscreenObserver = null;
  let dragDetach = null; // 上一组拖拽监听器的解绑函数，避免重复绑定
  let listenerAC = null; // 视频事件监听器的 AbortController
  let videoCheckTimer = null; // MutationObserver 触发的视频检测防抖定时器
  let lastVideoScan = 0; // 上次全量扫描视频的时间，限制扫描频率
  let fsCheckPending = false; // 全屏检测的 rAF 节流标记
  let toastTimer = null;
  let cfg = {
    // 横/竖面板各自维护一份按钮列表，互不影响
    speedsH: [...CONFIG.DEFAULT_SPEEDS],
    speedsV: [...CONFIG.DEFAULT_SPEEDS],
    seeksH: [...CONFIG.DEFAULT_SEEKS],
    seeksV: [...CONFIG.DEFAULT_SEEKS],
    speedStep: CONFIG.DEFAULT_SPEED_STEP,
    seeksVer: CONFIG.SEEKS_VERSION,
    seekOrderV: CONFIG.DEFAULT_SEEK_ORDER_V,
    ui: { ...CONFIG.DEFAULT_UI },
    positionMode: "proportional",
    proportionalPos: { x: 0.5, y: 0.5 },
  };

  // ==================== 工具函数 ====================
  function loadConfig() {
    try {
      const s = GM_getValue(P + "_cfg");
      if (!s) return;
      const p = JSON.parse(s) || {};
      const clamp = (v, rule, fallback) =>
        typeof v === "number" && isFinite(v)
          ? Math.max(rule.min, Math.min(rule.max, v))
          : fallback;

      // 列表清洗：过滤损坏值、去重、限制数量
      const sanitizeList = (arr, { min, max, integer }) => {
        const out = [];
        if (!Array.isArray(arr)) return out;
        for (const v of arr) {
          if (typeof v !== "number" || !isFinite(v) || v === 0) continue;
          if (v < min || v > max) continue;
          const value = integer ? Math.round(v) : Math.round(v * 100) / 100;
          if (out.some((x) => Math.abs(x - value) < 1e-9)) continue;
          out.push(value);
          if (out.length >= CONFIG.MAX_LIST_ITEMS) break;
        }
        return out;
      };
      const sanitizeSpeeds = (arr) =>
        sanitizeList(arr, { min: CONFIG.SPEED_MIN, max: CONFIG.SPEED_MAX, integer: false });
      const sanitizeSeeks = (arr) =>
        sanitizeList(arr, { min: CONFIG.SEEK_MIN, max: CONFIG.SEEK_MAX, integer: true });

      // 旧版存档只有一份 speeds/seeks，读取时同时作为横竖面板的初始值
      const legacySpeeds = sanitizeSpeeds(p.speeds);
      const legacySeeks =
        p.seeksVer === CONFIG.SEEKS_VERSION ? sanitizeSeeks(p.seeks) : [];
      const fallbackSpeeds = legacySpeeds.length
        ? legacySpeeds
        : [...CONFIG.DEFAULT_SPEEDS];
      const fallbackSeeks = legacySeeks.length
        ? legacySeeks
        : [...CONFIG.DEFAULT_SEEKS];

      const speedsH = sanitizeSpeeds(p.speedsH);
      const speedsV = sanitizeSpeeds(p.speedsV);
      const seeksH = sanitizeSeeks(p.seeksH);
      const seeksV = sanitizeSeeks(p.seeksV);
      cfg.speedsH = speedsH.length ? speedsH : [...fallbackSpeeds];
      cfg.speedsV = speedsV.length ? speedsV : [...fallbackSpeeds];
      cfg.seeksH = seeksH.length ? seeksH : [...fallbackSeeks];
      cfg.seeksV = seeksV.length ? seeksV : [...fallbackSeeks];
      cfg.speedStep = clamp(
        p.speedStep,
        CONFIG.VALIDATORS.speedStep,
        CONFIG.DEFAULT_SPEED_STEP,
      );

      cfg.seeksVer = CONFIG.SEEKS_VERSION;
      cfg.seekOrderV =
        p.seekOrderV === "forward" ? "forward" : CONFIG.DEFAULT_SEEK_ORDER_V;

      const ui = p.ui && typeof p.ui === "object" ? p.ui : {};
      cfg.ui = {
        opacity: clamp(ui.opacity, CONFIG.VALIDATORS.opacity, CONFIG.DEFAULT_UI.opacity),
        fontSize: Math.round(
          clamp(ui.fontSize, CONFIG.VALIDATORS.fontSize, CONFIG.DEFAULT_UI.fontSize),
        ),
        brightness: clamp(
          ui.brightness,
          CONFIG.VALIDATORS.brightness,
          CONFIG.DEFAULT_UI.brightness,
        ),
        volume: clamp(ui.volume, CONFIG.VALIDATORS.volume, CONFIG.DEFAULT_UI.volume),
        btnSize: Math.round(
          clamp(ui.btnSize, CONFIG.VALIDATORS.btnSize, CONFIG.DEFAULT_UI.btnSize),
        ),
      };

      cfg.positionMode =
        p.positionMode === "absolute" ? "absolute" : "proportional";
      const pp = p.proportionalPos;
      cfg.proportionalPos = {
        x: typeof pp?.x === "number" && isFinite(pp.x) ? Math.max(0, Math.min(1, pp.x)) : 0.5,
        y: typeof pp?.y === "number" && isFinite(pp.y) ? Math.max(0, Math.min(1, pp.y)) : 0.5,
      };
    } catch (e) {
      L("Config load error: " + e);
    }
  }
  loadConfig();
  isVertical = GM_getValue(P + "_layout") === "v";

  function saveConfig() {
    try {
      GM_setValue(P + "_cfg", JSON.stringify(cfg));
    } catch (e) {
      L("Config save error: " + e);
    }
  }

  // 清空本地存档并把内存配置恢复为脚本内 CONFIG 的默认值
  function clearAllConfig() {
    try {
      GM_deleteValue(P + "_cfg");
      GM_deleteValue(P + "_pos");
      GM_deleteValue(P + "_layout");
      GM_deleteValue(P + "_visible");
    } catch (e) {
      L("Config clear error: " + e);
    }
    cfg = {
      speedsH: [...CONFIG.DEFAULT_SPEEDS],
      speedsV: [...CONFIG.DEFAULT_SPEEDS],
      seeksH: [...CONFIG.DEFAULT_SEEKS],
      seeksV: [...CONFIG.DEFAULT_SEEKS],
      speedStep: CONFIG.DEFAULT_SPEED_STEP,
      seeksVer: CONFIG.SEEKS_VERSION,
      seekOrderV: CONFIG.DEFAULT_SEEK_ORDER_V,
      ui: { ...CONFIG.DEFAULT_UI },
      positionMode: "proportional",
      proportionalPos: { x: 0.5, y: 0.5 },
    };
    isVertical = false;
    visible = true;
    lastPos = { x: "10px", y: "10px" };
    // 撤销脚本此前对视频元素做的亮度/音量覆盖
    if (videoEl) {
      videoEl.style.filter = "";
      videoEl.volume = CONFIG.DEFAULT_UI.volume;
    }
  }

  // 读取上次保存的绝对位置，校验格式避免写入无效样式
  function loadSavedPos() {
    try {
      const s = GM_getValue(P + "_pos");
      if (!s) return;
      const p = JSON.parse(s);
      if (p && typeof p.x === "string" && typeof p.y === "string") {
        lastPos = { x: p.x, y: p.y };
      }
    } catch (e) {}
  }

  function formatTime(t, isSeek) {
    if (isNaN(t) || !isFinite(t)) return "00:00";
    if (isSeek) {
      const abs = Math.abs(t),
        sign = t < 0 ? "- " : "+ ";
      if (abs < 1) return sign + "0s";
      const m = Math.floor(abs / 60),
        s = Math.round(abs % 60);
      return sign + (m ? m + "m" + (s ? " " + s + "s" : "") : s + "s");
    }
    const h = Math.floor(t / 3600)
        .toString()
        .padStart(2, "0"),
      m = Math.floor((t % 3600) / 60)
        .toString()
        .padStart(2, "0"),
      s = Math.floor(t % 60)
        .toString()
        .padStart(2, "0");
    return h === "00" ? `${m}:${s}` : `${h}:${m}:${s}`;
  }

  // 快进按钮文案：优先用内置标签，其余按秒/分自动格式化
  function formatSeekLabel(v) {
    if (!isFinite(v)) return "—";
    if (CONFIG.TEXT.SEEK_LABELS[v]) return CONFIG.TEXT.SEEK_LABELS[v];
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "+";
    if (abs >= 60) {
      const m = Math.floor(abs / 60);
      const s = abs % 60;
      return sign + m + "m" + (s ? s + "s" : "");
    }
    return sign + abs + "s";
  }

  function formatSpeedLabel(v) {
    return isFinite(v) ? parseFloat(v.toFixed(2)) + "x" : "—";
  }

  function showSeek(amount) {
    totalSeek += amount;
    let note = document.getElementById(P + "-seek");
    if (!note && controls) {
      note = document.createElement("div");
      note.id = P + "-seek";
      note.style.cssText = CONFIG.STYLE.SEEK_NOTICE;
      controls.insertBefore(note, controls.firstChild);
    }
    if (note) {
      note.textContent = formatTime(totalSeek, true);
      note.style.opacity = "1";
    }
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
      if (note) note.style.opacity = "0";
      totalSeek = 0;
    }, 1500);
  }

  function updateTotalTime() {
    if (totalTime && videoEl && isFinite(videoEl.duration) && videoEl.duration > 0) {
      totalTime.textContent = "/ " + formatTime(videoEl.duration);
    }
  }

  function updateProgress() {
    if (
      videoEl &&
      progress &&
      isFinite(videoEl.duration) &&
      videoEl.duration > 0
    ) {
      progress.value = Math.min(
        10000,
        Math.max(0, (videoEl.currentTime / videoEl.duration) * 10000),
      );
      if (curTime) curTime.textContent = formatTime(videoEl.currentTime);
      // 顺便更新总时长，作为 loadedmetadata 没触发的兜底
      updateTotalTime();
    }
  }

  function isInteractive(el) {
    return (
      el.closest('button, input, select, textarea, a, [role="button"]') !== null
    );
  }

  function showToast(msg, type = "success") {
    const host =
      (isFullscreen && fullscreenContainer) || document.body;
    if (!host) return;
    let toast = document.getElementById(P + "-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = P + "-toast";
      toast.style.cssText = CONFIG.STYLE.TOAST;
    }
    if (toast.parentNode !== host) host.appendChild(toast);
    toast.textContent = msg;
    toast.style.background =
      type === "error" ? "rgba(231,76,60,.95)" : "rgba(39,174,96,.95)";
    toast.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
    }, 2000);
  }

  function applyPosition() {
    if (!controls) return;
    if (cfg.positionMode === "proportional") {
      const rect = controls.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = vw * cfg.proportionalPos.x - rect.width / 2;
      let top = vh * cfg.proportionalPos.y - rect.height / 2;
      left = Math.max(0, Math.min(left, vw - rect.width));
      top = Math.max(0, Math.min(top, vh - rect.height));
      controls.style.left = left + "px";
      controls.style.top = top + "px";
    } else {
      controls.style.left = lastPos.x;
      controls.style.top = lastPos.y;
    }
  }

  function applyUiConfig() {
    if (!controls) return;
    controls.style.background = `rgba(0,0,0,${cfg.ui.opacity})`;
    controls.style.fontSize = cfg.ui.fontSize + "px";
    if (isVertical) {
      controls.querySelectorAll("button, [data-speed-display]").forEach((b) => {
        b.style.fontSize = cfg.ui.btnSize + "px";
      });
      controls.style.width = Math.max(85, cfg.ui.btnSize * 6 + 20) + "px";
    }
  }

  // ==================== 网页内全屏适配 ====================
  function detectFullscreenContainer() {
    if (!videoEl) return null;
    // 优先识别浏览器原生全屏（Fullscreen API）
    const native = getNativeFullscreenContainer();
    if (native && native.ownerDocument === document) return native;
    let container = videoEl.parentElement;
    while (container && container !== document.body) {
      const style = window.getComputedStyle(container);
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (
        (style.position === "fixed" || style.position === "absolute") &&
        w >= vw * 0.9 && h >= vh * 0.9
      ) {
        return container;
      }
      container = container.parentElement;
    }
    return null;
  }

  function repositionControlsInFullscreen() {
    if (!controls || !videoEl) return;
    const container = fullscreenContainer || videoEl.parentElement;
    if (!container) return;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const rect = controls.getBoundingClientRect();
    const panelW = rect.width || 320;
    const panelH = rect.height || 200;
    if (cfg.positionMode === "proportional") {
      let left = cw * cfg.proportionalPos.x - panelW / 2;
      let top = ch * cfg.proportionalPos.y - panelH / 2;
      left = Math.max(5, Math.min(left, cw - panelW - 5));
      top = Math.max(5, Math.min(top, ch - panelH - 5));
      controls.style.left = left + "px";
      controls.style.top = top + "px";
    } else {
      let left = parseFloat(lastPos.x) || 10;
      let top = parseFloat(lastPos.y) || 10;
      left = Math.max(5, Math.min(left, cw - panelW - 5));
      top = Math.max(5, Math.min(top, ch - panelH - 5));
      controls.style.left = left + "px";
      controls.style.top = top + "px";
    }
  }

  function moveFloatingUI(host) {
    if (floatBtn) host.appendChild(floatBtn);
    if (settingsOverlay) host.appendChild(settingsOverlay);
  }

  function enterFullscreen(container) {
    if (isFullscreen || !controls || !container) return;
    // 视频本身无法容纳子节点；跨文档（iframe）容器也不能挂载
    if (container.tagName === "VIDEO") container = container.parentElement;
    if (!container || container.ownerDocument !== controls.ownerDocument) return;
    L("Enter webpage fullscreen");
    originalParent = controls.parentNode || document.body;
    fullscreenContainer = container;
    container.appendChild(controls);
    // 浮动按钮和设置层也一起移入全屏层，否则隐藏后无法恢复
    moveFloatingUI(container);
    controls.style.position = "absolute";
    controls.style.zIndex = "999999";
    repositionControlsInFullscreen();
    setupDrag(controls);
    isFullscreen = true;
  }

  function exitFullscreen() {
    if (!isFullscreen || !controls) return;
    L("Exit webpage fullscreen");
    if (originalParent) {
      originalParent.appendChild(controls);
    } else {
      document.body.appendChild(controls);
    }
    moveFloatingUI(document.body);
    controls.style.position = "fixed";
    controls.style.zIndex = "99999";
    applyPosition();
    setupDrag(controls);
    isFullscreen = false;
    originalParent = null;
    fullscreenContainer = null;
  }

  function checkFullscreenState() {
    const container = detectFullscreenContainer();
    if (container && !isFullscreen) {
      enterFullscreen(container);
    } else if (!container && isFullscreen) {
      exitFullscreen();
    } else if (isFullscreen) {
      repositionControlsInFullscreen();
    }
  }

  function setupFullscreenDetection() {
    if (fullscreenObserver) fullscreenObserver.disconnect();
    fullscreenObserver = new MutationObserver(scheduleFullscreenCheck);
    fullscreenObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
      subtree: true,
      childList: false,
    });
    checkFullscreenState();
  }

  // 样式类 mutation 可能非常频繁，用 rAF 合并为每帧一次全屏检测
  function scheduleFullscreenCheck() {
    if (fsCheckPending) return;
    fsCheckPending = true;
    requestAnimationFrame(() => {
      fsCheckPending = false;
      if (!videoEl || !document.body.contains(videoEl)) return;
      checkFullscreenState();
    });
  }

  // 浏览器原生全屏（Fullscreen API）时，面板必须挂到全屏元素内，否则会被全屏层遮住
  function getNativeFullscreenContainer() {
    const el =
      document.fullscreenElement || document.webkitFullscreenElement || null;
    if (!el || el === document.body) return null;
    // 视频元素本身不能容纳子节点，退到其父容器
    return el.tagName === "VIDEO" ? el.parentElement : el;
  }

  function handleNativeFullscreen() {
    if (!controls) return;
    const target = getNativeFullscreenContainer();
    if (target) {
      if (isFullscreen) exitFullscreen();
      enterFullscreen(target);
    } else {
      if (isFullscreen) exitFullscreen();
      checkFullscreenState();
    }
  }

  // ==================== 视频查找 ====================
  function findVideo() {
    let candidates = [];
    const focusedVideo = document.querySelector("video:focus");
    const collect = (doc, ctxScore = 0) => {
      try {
        doc.querySelectorAll("video").forEach((v) => {
          if (
            v.offsetWidth < CONFIG.MIN_VIDEO_SIZE ||
            v.offsetHeight < CONFIG.MIN_VIDEO_SIZE
          )
            return;
          if (!v.src && !v.srcObject && !v.querySelector("source")) return;
          let score = ctxScore;
          if (v.hasAttribute("controls")) score += 10;
          if (v.hasAttribute("autoplay")) score += 5;
          if (v.paused === false) score += 15;
          if (v === focusedVideo) score += 20;
          score += Math.min((v.offsetWidth * v.offsetHeight) / 10000, 30);
          candidates.push({ video: v, score });
        });
        doc.querySelectorAll("iframe").forEach((f) => {
          try {
            if (f.contentDocument) collect(f.contentDocument, ctxScore + 5);
          } catch (e) {}
        });
        doc.querySelectorAll("*").forEach((h) => {
          if (h.shadowRoot) collect(h.shadowRoot, ctxScore);
        });
      } catch (e) {}
    };
    collect(document);
    if (!candidates.length) return null;
    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        b.video.offsetWidth * b.video.offsetHeight -
          a.video.offsetWidth * a.video.offsetHeight,
    );
    L(`Found ${candidates.length} video(s), best score:${candidates[0].score}`);
    return candidates[0].video;
  }

  // ==================== UI构建 ====================
  function createSeekButton(val, compact = false) {
    const btn = document.createElement("button");
    btn.textContent = formatSeekLabel(val);
    btn.style.cssText = compact ? CONFIG.STYLE.SEEK_BTN_VERT : CONFIG.STYLE.SEEK_BTN;
    if (compact) btn.style.fontSize = cfg.ui.btnSize + "px";
    btn.onmouseenter = () => (btn.style.background = CONFIG.STYLE.SEEK_BTN_HOVER);
    btn.onmouseleave = () => (btn.style.background = "#2a2a2a");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!videoEl) return;
      videoEl.currentTime = Math.max(0, videoEl.currentTime + val);
      showSeek(val);
    });
    return btn;
  }

  function renderSeekRow(container) {
    cfg.seeksH.forEach((val) => {
      container.appendChild(createSeekButton(val));
    });
  }

  function adjustSpeed(dir) {
    if (!videoEl) return;
    const step = cfg.speedStep || CONFIG.DEFAULT_SPEED_STEP;
    let rate = videoEl.playbackRate + dir * step;
    rate = Math.max(
      CONFIG.SPEED_MIN,
      Math.min(CONFIG.SPEED_MAX, Math.round(rate * 100) / 100),
    );
    videoEl.playbackRate = rate;
  }

  function createSpeedAdjustBtn(dir, compact = false) {
    const btn = document.createElement("button");
    btn.textContent = dir > 0 ? "+" : "−";
    btn.title = dir > 0 ? "增加倍速" : "减少倍速";
    btn.style.cssText = compact
      ? CONFIG.STYLE.SPEED_BTN_VERT
      : CONFIG.STYLE.SPEED_BTN;
    if (compact) btn.style.fontSize = cfg.ui.btnSize + "px";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      adjustSpeed(dir);
    });
    return btn;
  }

  // 当前倍速读数（常驻显示，ratechange 时刷新）
  function updateSpeedDisplay() {
    if (!speedDisplay) return;
    speedDisplay.textContent = videoEl
      ? parseFloat(videoEl.playbackRate.toFixed(2)) + "x"
      : "–";
  }

  function createSpeedDisplay(compact = false) {
    speedDisplay = document.createElement("span");
    speedDisplay.id = P + "-speedval";
    speedDisplay.setAttribute("data-speed-display", "");
    speedDisplay.style.cssText = compact
      ? CONFIG.STYLE.SPEED_DISPLAY_VERT
      : CONFIG.STYLE.SPEED_DISPLAY;
    if (compact) speedDisplay.style.fontSize = cfg.ui.btnSize + "px";
    speedDisplay.textContent = "–";
    updateSpeedDisplay();
    return speedDisplay;
  }

  function createSpeedButton(sp, compact = false) {
    const btn = document.createElement("button");
    btn.textContent = formatSpeedLabel(sp);
    btn.dataset.speed = sp;
    btn.style.cssText = compact
      ? CONFIG.STYLE.SPEED_BTN_VERT
      : CONFIG.STYLE.SPEED_BTN;
    if (compact) btn.style.fontSize = cfg.ui.btnSize + "px";
    if (videoEl && Math.abs(videoEl.playbackRate - sp) < 0.01) {
      btn.style.background = CONFIG.STYLE.SPEED_BTN_ACTIVE;
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!videoEl) return;
      videoEl.playbackRate = sp;
      updateSpeedHighlight();
    });
    return btn;
  }

  function renderSpeedRow(container) {
    container.append(
      createSpeedAdjustBtn(-1),
      createSpeedDisplay(),
      createSpeedAdjustBtn(1),
    );
    cfg.speedsH.forEach((sp) => container.appendChild(createSpeedButton(sp)));
  }

  // ============ 列表编辑器（快进/倍速按钮的增删改与排序） ============
  function createListEditor({
    title,
    hint,
    values,
    min,
    max,
    step,
    format,
    defaultAdd,
    addText,
    maxItems,
  }) {
    const section = document.createElement("div");
    section.style.cssText = CONFIG.STYLE.SECTION;
    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = title;
    sectionTitle.style.cssText = CONFIG.STYLE.SECTION_TITLE;
    const hintEl = document.createElement("p");
    hintEl.textContent = hint;
    hintEl.style.cssText = "margin:-4px 0 10px;color:#888;font-size:12px;line-height:1.5";

    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:6px";

    const createRow = (value) => {
      const row = document.createElement("div");
      row.style.cssText = CONFIG.STYLE.ITEM_ROW;

      const input = document.createElement("input");
      input.type = "number";
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = value;
      input.style.cssText = CONFIG.STYLE.ITEM_INPUT;

      const preview = document.createElement("span");
      preview.style.cssText = CONFIG.STYLE.ITEM_PREVIEW;
      preview.textContent = format(parseFloat(input.value));
      input.addEventListener("input", () => {
        preview.textContent = format(parseFloat(input.value));
      });

      const up = document.createElement("button");
      up.textContent = "↑";
      up.title = "上移";
      up.style.cssText = CONFIG.STYLE.ITEM_MOVE;
      up.addEventListener("click", () => {
        const prev = row.previousElementSibling;
        if (prev) list.insertBefore(row, prev);
      });

      const down = document.createElement("button");
      down.textContent = "↓";
      down.title = "下移";
      down.style.cssText = CONFIG.STYLE.ITEM_MOVE;
      down.addEventListener("click", () => {
        const next = row.nextElementSibling;
        if (next) list.insertBefore(row, next.nextElementSibling);
      });

      const del = document.createElement("button");
      del.textContent = "✕";
      del.title = "删除";
      del.style.cssText = CONFIG.STYLE.ITEM_DEL;
      del.addEventListener("click", () => row.remove());

      row.append(input, preview, up, down, del);
      return row;
    };

    values.forEach((v) => list.appendChild(createRow(v)));

    const addBtn = document.createElement("button");
    addBtn.textContent = addText;
    addBtn.style.cssText = CONFIG.STYLE.ADD_BTN;
    addBtn.addEventListener("click", () => {
      if (list.children.length >= maxItems) {
        showToast(`最多 ${maxItems} 项`, "error");
        return;
      }
      const current = Array.from(list.children).map((row) =>
        parseFloat(row.querySelector("input").value),
      );
      list.appendChild(createRow(defaultAdd(current)));
    });

    section.append(sectionTitle, hintEl, list, addBtn);

    return {
      section,
      getValues: () =>
        Array.from(list.children).map((row) =>
          parseFloat(row.querySelector("input").value),
        ),
      // 切换配置对象时整表替换，用于在横/竖面板列表之间切换
      setValues: (vals) => {
        list.textContent = "";
        vals.forEach((v) => list.appendChild(createRow(v)));
      },
    };
  }

  // 校验编辑器返回的数值：非空、范围、去重、至少一项
  function collectEditorValues(editor, { min, max, decimals, allowZero, label }) {
    const values = [];
    for (const raw of editor.getValues()) {
      if (!isFinite(raw)) return { error: `${label}存在空值或非数字` };
      if (!allowZero && raw === 0) return { error: `${label}不能为 0` };
      if (raw < min || raw > max)
        return { error: `${label}取值需在 ${min} ~ ${max} 之间` };
      const factor = Math.pow(10, decimals);
      const value = Math.round(raw * factor) / factor;
      if (values.some((v) => Math.abs(v - value) < 1e-9))
        return { error: `${label}存在重复值：${value}` };
      values.push(value);
    }
    if (!values.length) return { error: `${label}至少保留一项` };
    return { values };
  }

  // ============ 增强版设置面板 ============
  function showSettings() {
    if (settingsOverlay) return; // 防止重复打开

    // 打开面板时的配置快照，取消时用于还原（避免“取消”后界面已被改动）
    const snapshot = {
      ui: { ...cfg.ui },
      speedStep: cfg.speedStep,
      positionMode: cfg.positionMode,
      proportionalPos: { ...cfg.proportionalPos },
      lastPos: { ...lastPos },
    };

    settingsOverlay = document.createElement("div");
    settingsOverlay.id = P + "-overlay";
    settingsOverlay.style.cssText = CONFIG.STYLE.OVERLAY;

    const dlg = document.createElement("div");
    dlg.style.cssText = CONFIG.STYLE.DIALOG;

    // 头部
    const header = document.createElement("div");
    header.style.cssText = CONFIG.STYLE.DIALOG_HEADER;
    const title = document.createElement("h3");
    title.textContent = CONFIG.TEXT.SETTINGS_TITLE;
    title.style.cssText = CONFIG.STYLE.DIALOG_TITLE;
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    closeBtn.style.cssText = CONFIG.STYLE.DIALOG_CLOSE;
    closeBtn.title = "关闭 (ESC)";
    header.append(title, closeBtn);

    // UI设置区域
    const uiSection = document.createElement("div");
    uiSection.style.cssText = CONFIG.STYLE.SECTION;
    const uiTitle = document.createElement("h4");
    uiTitle.textContent = "🎨 " + CONFIG.TEXT.UI_LABEL;
    uiTitle.style.cssText = CONFIG.STYLE.SECTION_TITLE;

    // 透明度
    const opacityRow = document.createElement("div");
    opacityRow.style.cssText = CONFIG.STYLE.UI_ROW;
    const opacityLabel = document.createElement("span");
    opacityLabel.textContent = "面板透明度:";
    opacityLabel.style.cssText = CONFIG.STYLE.UI_LABEL;
    const opacityInput = document.createElement("input");
    opacityInput.type = "range";
    opacityInput.min = CONFIG.VALIDATORS.opacity.min;
    opacityInput.max = CONFIG.VALIDATORS.opacity.max;
    opacityInput.step = CONFIG.VALIDATORS.opacity.step;
    opacityInput.value = cfg.ui.opacity;
    opacityInput.style.cssText = CONFIG.STYLE.UI_RANGE;
    const opacityVal = document.createElement("span");
    opacityVal.textContent = Math.round(cfg.ui.opacity * 100) + "%";
    opacityVal.style.cssText = "min-width:40px;text-align:right;color:#7ed6df";
    opacityInput.addEventListener("input", () => {
      const val = parseFloat(opacityInput.value);
      opacityVal.textContent = Math.round(val * 100) + "%";
      cfg.ui.opacity = val;
      applyUiConfig();
    });
    opacityRow.append(opacityLabel, opacityInput, opacityVal);

    // 字体大小
    const fontRow = document.createElement("div");
    fontRow.style.cssText = CONFIG.STYLE.UI_ROW;
    const fontLabel = document.createElement("span");
    fontLabel.textContent = "字体大小:";
    fontLabel.style.cssText = CONFIG.STYLE.UI_LABEL;
    const fontInput = document.createElement("input");
    fontInput.type = "number";
    fontInput.min = CONFIG.VALIDATORS.fontSize.min;
    fontInput.max = CONFIG.VALIDATORS.fontSize.max;
    fontInput.value = cfg.ui.fontSize;
    fontInput.style.cssText = CONFIG.STYLE.UI_INPUT;
    fontInput.addEventListener("change", () => {
      const val = parseInt(fontInput.value);
      if (
        val >= CONFIG.VALIDATORS.fontSize.min &&
        val <= CONFIG.VALIDATORS.fontSize.max
      ) {
        cfg.ui.fontSize = val;
        applyUiConfig();
      }
    });
    fontRow.append(fontLabel, fontInput);

    // 按钮大小
    const btnSizeRow = document.createElement("div");
    btnSizeRow.style.cssText = CONFIG.STYLE.UI_ROW;
    const btnSizeLabel = document.createElement("span");
    btnSizeLabel.textContent = "按钮大小:";
    btnSizeLabel.style.cssText = CONFIG.STYLE.UI_LABEL;
    const btnSizeInput = document.createElement("input");
    btnSizeInput.type = "range";
    btnSizeInput.min = CONFIG.VALIDATORS.btnSize.min;
    btnSizeInput.max = CONFIG.VALIDATORS.btnSize.max;
    btnSizeInput.step = CONFIG.VALIDATORS.btnSize.step;
    btnSizeInput.value = cfg.ui.btnSize;
    btnSizeInput.style.cssText = CONFIG.STYLE.UI_RANGE;
    const btnSizeVal = document.createElement("span");
    btnSizeVal.textContent = cfg.ui.btnSize + "px";
    btnSizeVal.style.cssText = "min-width:40px;text-align:right;color:#7ed6df";
    btnSizeInput.addEventListener("input", () => {
      const val = parseInt(btnSizeInput.value);
      btnSizeVal.textContent = val + "px";
      cfg.ui.btnSize = val;
      applyUiConfig();
    });
    btnSizeRow.append(btnSizeLabel, btnSizeInput, btnSizeVal);

    uiSection.append(uiTitle, opacityRow, fontRow, btnSizeRow);

    // ============ 配置对象（横/竖面板各自独立） ============
    const layoutSection = document.createElement("div");
    layoutSection.style.cssText = CONFIG.STYLE.SECTION;
    const layoutTitle = document.createElement("h4");
    layoutTitle.textContent = "🧭 配置对象";
    layoutTitle.style.cssText = CONFIG.STYLE.SECTION_TITLE;

    let editLayout = isVertical ? "v" : "h";
    const layoutRow = document.createElement("div");
    layoutRow.style.cssText = "display:flex;gap:16px;flex-wrap:wrap;margin:8px 0";
    const makeLayoutLabel = (value, text) => {
      const label = document.createElement("label");
      label.style.cssText =
        "display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = P + "-editLayout";
      radio.value = value;
      radio.checked = editLayout === value;
      label.append(radio, text);
      return { label, radio };
    };
    const hLayoutOpt = makeLayoutLabel("h", "水平面板");
    const vLayoutOpt = makeLayoutLabel("v", "垂直面板");
    layoutRow.append(hLayoutOpt.label, vLayoutOpt.label);

    const layoutHint = document.createElement("p");
    layoutHint.textContent =
      "快进/倍速按钮列表按面板布局分别保存，修改其中一种布局不会影响另一种";
    layoutHint.style.cssText =
      "margin:4px 0 0;color:#888;font-size:12px;line-height:1.5";
    layoutSection.append(layoutTitle, layoutRow, layoutHint);

    // 两种布局的编辑草稿（切换配置对象时保留尚未保存的修改）
    const drafts = {
      h: { speeds: [...cfg.speedsH], seeks: [...cfg.seeksH] },
      v: { speeds: [...cfg.speedsV], seeks: [...cfg.seeksV] },
    };

    // ============ 倍速设置区域 ============
    const speedSection = document.createElement("div");
    speedSection.style.cssText = CONFIG.STYLE.SECTION;
    const speedTitle = document.createElement("h4");
    speedTitle.textContent = "🎬 倍速设置";
    speedTitle.style.cssText = CONFIG.STYLE.SECTION_TITLE;

    const stepRow = document.createElement("div");
    stepRow.style.cssText = CONFIG.STYLE.UI_ROW;
    const stepLabel = document.createElement("span");
    stepLabel.textContent = "调整步进:";
    stepLabel.style.cssText = CONFIG.STYLE.UI_LABEL;
    const stepInput = document.createElement("input");
    stepInput.type = "number";
    stepInput.min = CONFIG.VALIDATORS.speedStep.min;
    stepInput.max = CONFIG.VALIDATORS.speedStep.max;
    stepInput.step = CONFIG.VALIDATORS.speedStep.step;
    stepInput.value = cfg.speedStep;
    stepInput.style.cssText = CONFIG.STYLE.UI_INPUT;
    const stepHint = document.createElement("span");
    stepHint.textContent = "x（−/+ 每次调整幅度）";
    stepHint.style.cssText = "color:#888;font-size:12px";
    stepRow.append(stepLabel, stepInput, stepHint);

    speedSection.append(speedTitle, stepRow);

    // 倍速按钮列表编辑
    const speedEditor = createListEditor({
      title: "🎚 倍速按钮",
      hint: "按列表顺序显示在面板上；取值范围 0.1x ~ 16x",
      values: [...drafts[editLayout].speeds],
      min: CONFIG.SPEED_MIN,
      max: CONFIG.SPEED_MAX,
      step: 0.05,
      format: formatSpeedLabel,
      addText: "＋ 添加倍速按钮",
      maxItems: CONFIG.MAX_LIST_ITEMS,
      defaultAdd: (current) => {
        const candidates = [1.75, 2.25, 2.75, 3.5, 0.75, 4.0];
        return (
          candidates.find((v) => !current.some((x) => Math.abs(x - v) < 1e-9)) ||
          1.5
        );
      },
    });

    // 快进按钮列表编辑
    const seekEditor = createListEditor({
      title: "⏩ 快进按钮",
      hint: "数值单位为秒，负数表示快退；按列表顺序显示在面板上",
      values: [...drafts[editLayout].seeks],
      min: CONFIG.SEEK_MIN,
      max: CONFIG.SEEK_MAX,
      step: 1,
      format: formatSeekLabel,
      addText: "＋ 添加快进按钮",
      maxItems: CONFIG.MAX_LIST_ITEMS,
      defaultAdd: (current) => {
        const candidates = [30, 15, 5, 60, 120, -30, -60];
        return (
          candidates.find((v) => !current.some((x) => Math.abs(x - v) < 1e-9)) ||
          10
        );
      },
    });

    speedEditor.section.id = P + "-speed-editor";
    seekEditor.section.id = P + "-seek-editor";

    // 切换配置对象：先把当前界面值写入草稿，再载入目标布局的草稿
    const captureDraft = () => {
      drafts[editLayout].speeds = speedEditor.getValues();
      drafts[editLayout].seeks = seekEditor.getValues();
    };
    const loadDraft = () => {
      speedEditor.setValues(drafts[editLayout].speeds);
      seekEditor.setValues(drafts[editLayout].seeks);
    };
    const selectLayout = (layout) => {
      if (layout === editLayout) return;
      captureDraft();
      editLayout = layout;
      hLayoutOpt.radio.checked = layout === "h";
      vLayoutOpt.radio.checked = layout === "v";
      loadDraft();
    };
    hLayoutOpt.radio.addEventListener("change", () => {
      if (hLayoutOpt.radio.checked) selectLayout("h");
    });
    vLayoutOpt.radio.addEventListener("change", () => {
      if (vLayoutOpt.radio.checked) selectLayout("v");
    });

    // 垂直面板内快进/快退按钮的上下方向（放在快进按钮列表下方）
    const seekOrderWrap = document.createElement("div");
    seekOrderWrap.id = P + "-seek-order-v";
    seekOrderWrap.style.cssText =
      "margin-top:12px;padding-top:10px;border-top:1px solid #333";
    const seekOrderCaption = document.createElement("div");
    seekOrderCaption.textContent = "垂直面板：快进/快退按钮从上到下的顺序";
    seekOrderCaption.style.cssText =
      "margin:0 0 6px;font-size:13px;color:#7ed6df";
    const seekOrderRow = document.createElement("div");
    seekOrderRow.style.cssText =
      "display:flex;gap:16px;flex-wrap:wrap;margin:6px 0";
    const makeSeekOrderLabel = (value, text, desc) => {
      const label = document.createElement("label");
      label.style.cssText =
        "display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px";
      label.title = desc;
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = P + "-seekOrderV";
      radio.value = value;
      radio.checked = cfg.seekOrderV === value;
      label.append(radio, text);
      return label;
    };
    seekOrderRow.append(
      makeSeekOrderLabel(
        "backward",
        "快退在前（- → +）",
        "先显示快退按钮，再显示快进按钮",
      ),
      makeSeekOrderLabel(
        "forward",
        "快进在前（+ → -）",
        "先显示快进按钮，再显示快退按钮",
      ),
    );
    const seekOrderHint = document.createElement("p");
    seekOrderHint.textContent =
      "仅影响垂直面板；同一方向内仍按列表中的先后顺序排列";
    seekOrderHint.style.cssText =
      "margin:4px 0 0;color:#888;font-size:12px;line-height:1.5";
    seekOrderWrap.append(seekOrderCaption, seekOrderRow, seekOrderHint);
    seekEditor.section.appendChild(seekOrderWrap);

    // ============ 定位方式区域 ============
    const posModeSection = document.createElement("div");
    posModeSection.style.cssText = CONFIG.STYLE.SECTION;
    const posModeTitle = document.createElement("h4");
    posModeTitle.textContent = "📌 定位方式";
    posModeTitle.style.cssText = CONFIG.STYLE.SECTION_TITLE;

    const modeRow = document.createElement("div");
    modeRow.style.cssText = "display:flex;gap:16px;margin:8px 0";
    const absLabel = document.createElement("label");
    absLabel.style.cssText = "display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px";
    const absRadio = document.createElement("input");
    absRadio.type = "radio";
    absRadio.name = P + "-posMode";
    absRadio.value = "absolute";
    absRadio.checked = cfg.positionMode === "absolute";
    absLabel.append(absRadio, "绝对位置（像素）");
    const propLabel = document.createElement("label");
    propLabel.style.cssText = "display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px";
    const propRadio = document.createElement("input");
    propRadio.type = "radio";
    propRadio.name = P + "-posMode";
    propRadio.value = "proportional";
    propRadio.checked = cfg.positionMode === "proportional";
    propLabel.append(propRadio, "相对位置（比例）");
    modeRow.append(absLabel, propLabel);

    const propBox = document.createElement("div");
    propBox.style.cssText = "margin-top:10px;" + (cfg.positionMode === "absolute" ? "display:none" : "");

    const pxRow = document.createElement("div");
    pxRow.style.cssText = CONFIG.STYLE.UI_ROW;
    const pxLabel = document.createElement("span");
    pxLabel.textContent = "水平:";
    pxLabel.style.cssText = CONFIG.STYLE.UI_LABEL;
    const pxInput = document.createElement("input");
    pxInput.type = "number";
    pxInput.min = 0;
    pxInput.max = 1;
    pxInput.step = 0.01;
    pxInput.value = cfg.proportionalPos.x;
    pxInput.style.cssText = CONFIG.STYLE.UI_INPUT;
    const pxVal = document.createElement("span");
    pxVal.textContent = Math.round(cfg.proportionalPos.x * 100) + "%";
    pxVal.style.cssText = "min-width:40px;text-align:right;color:#7ed6df";
    pxInput.addEventListener("input", () => {
      const v = Math.max(0, Math.min(1, parseFloat(pxInput.value) || 0));
      pxVal.textContent = Math.round(v * 100) + "%";
    });
    pxRow.append(pxLabel, pxInput, pxVal);

    const pyRow = document.createElement("div");
    pyRow.style.cssText = CONFIG.STYLE.UI_ROW;
    const pyLabel = document.createElement("span");
    pyLabel.textContent = "垂直:";
    pyLabel.style.cssText = CONFIG.STYLE.UI_LABEL;
    const pyInput = document.createElement("input");
    pyInput.type = "number";
    pyInput.min = 0;
    pyInput.max = 1;
    pyInput.step = 0.01;
    pyInput.value = cfg.proportionalPos.y;
    pyInput.style.cssText = CONFIG.STYLE.UI_INPUT;
    const pyVal = document.createElement("span");
    pyVal.textContent = Math.round(cfg.proportionalPos.y * 100) + "%";
    pyVal.style.cssText = "min-width:40px;text-align:right;color:#7ed6df";
    pyInput.addEventListener("input", () => {
      const v = Math.max(0, Math.min(1, parseFloat(pyInput.value) || 0));
      pyVal.textContent = Math.round(v * 100) + "%";
    });
    pyRow.append(pyLabel, pyInput, pyVal);

    propBox.append(pxRow, pyRow);

    absRadio.addEventListener("change", () => {
      if (!absRadio.checked) return;
      propBox.style.display = "none";
      if (controls) {
        const rect = controls.getBoundingClientRect();
        lastPos.x = Math.max(0, Math.round((window.innerWidth - rect.width) / 2)) + "px";
        lastPos.y = Math.max(0, Math.round((window.innerHeight - rect.height) / 2)) + "px";
        controls.style.left = lastPos.x;
        controls.style.top = lastPos.y;
      }
    });
    propRadio.addEventListener("change", () => {
      if (!propRadio.checked) return;
      propBox.style.display = "block";
      pxInput.value = 0.5;
      pyInput.value = 0.5;
      pxVal.textContent = "50%";
      pyVal.textContent = "50%";
      if (controls) {
        cfg.proportionalPos = { x: 0.5, y: 0.5 };
        applyPosition();
      }
    });

    posModeSection.append(posModeTitle, modeRow, propBox);

    // 按钮区域
    const btnRow = document.createElement("div");
    btnRow.style.cssText = CONFIG.STYLE.BTN_ROW;

    const clearBtn = document.createElement("button");
    clearBtn.textContent = CONFIG.TEXT.CLEAR;
    clearBtn.title = "清空所有本地配置，恢复为脚本内 CONFIG 默认值";
    clearBtn.style.cssText = CONFIG.STYLE.CLEAR_BTN;
    clearBtn.addEventListener("click", () => {
      if (
        !confirm(
          "确定要清空所有本地配置吗？\n快进/倍速列表、界面样式、位置和布局都会恢复为脚本内默认值。",
        )
      )
        return;
      clearAllConfig();
      closeSettings(true);
      rebuildPanel();
      showToast(CONFIG.TEXT.TOAST.CLEARED);
    });

    const btnGroup = document.createElement("div");
    btnGroup.style.cssText = CONFIG.STYLE.BTN_GROUP;

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = CONFIG.TEXT.CANCEL;
    cancelBtn.style.cssText = CONFIG.STYLE.CANCEL_BTN;

    const saveBtn = document.createElement("button");
    saveBtn.textContent = CONFIG.TEXT.SAVE;
    saveBtn.style.cssText = CONFIG.STYLE.SAVE_BTN;
    saveBtn.onmouseenter = () =>
      (saveBtn.style.background = CONFIG.STYLE.SAVE_BTN_HOVER);
    saveBtn.onmouseleave = () => (saveBtn.style.background = "#27ae60");

    btnGroup.append(cancelBtn, saveBtn);

    // 初始化：关闭面板，重新扫描视频并重建控制器
    const initBtn = document.createElement("button");
    initBtn.textContent = CONFIG.TEXT.INIT;
    initBtn.title = "重新扫描视频并重建控制面板";
    initBtn.style.cssText = CONFIG.STYLE.INIT_BTN;
    initBtn.addEventListener("click", () => {
      closeSettings(false);
      reinitialize();
    });

    const leftGroup = document.createElement("div");
    leftGroup.style.cssText = "display:flex;gap:8px";
    leftGroup.append(clearBtn, initBtn);
    btnRow.append(leftGroup, btnGroup);

    // 组装对话框
    dlg.append(
      header,
      uiSection,
      layoutSection,
      speedSection,
      speedEditor.section,
      seekEditor.section,
      posModeSection,
      btnRow,
    );
    settingsOverlay.appendChild(dlg);

    // 关闭逻辑
    const closeSettings = (commit = false) => {
      if (!commit) {
        // 未保存就关闭：还原打开面板前的配置与界面效果
        cfg.ui = { ...snapshot.ui };
        cfg.speedStep = snapshot.speedStep;
        cfg.positionMode = snapshot.positionMode;
        cfg.proportionalPos = { ...snapshot.proportionalPos };
        lastPos = { ...snapshot.lastPos };
        applyUiConfig();
        applyPosition();
      }
      if (settingsKeyHandler) {
        document.removeEventListener("keydown", settingsKeyHandler);
        settingsKeyHandler = null;
      }
      if (settingsOverlay && settingsOverlay.parentNode) {
        settingsOverlay.parentNode.removeChild(settingsOverlay);
        settingsOverlay = null;
      }
    };

    closeBtn.onclick = () => closeSettings(false);
    cancelBtn.onclick = () => closeSettings(false);
    settingsOverlay.addEventListener("click", (e) => {
      if (e.target === settingsOverlay) closeSettings(false);
    });

    // 保存逻辑
    saveBtn.onclick = () => {
      // 先把当前编辑的布局内容写入草稿，确保校验的是最新界面值
      captureDraft();

      // 横/竖两种布局分别校验；出错时自动切换到对应布局提示
      const validateLayout = (layout) => {
        const name = layout === "v" ? "垂直面板" : "水平面板";
        const seeksResult = collectEditorValues(
          { getValues: () => drafts[layout].seeks },
          {
            min: CONFIG.SEEK_MIN,
            max: CONFIG.SEEK_MAX,
            decimals: 0,
            allowZero: false,
            label: `${name}快进按钮`,
          },
        );
        if (seeksResult.error) return seeksResult;
        const speedsResult = collectEditorValues(
          { getValues: () => drafts[layout].speeds },
          {
            min: CONFIG.SPEED_MIN,
            max: CONFIG.SPEED_MAX,
            decimals: 2,
            allowZero: false,
            label: `${name}倍速按钮`,
          },
        );
        if (speedsResult.error) return speedsResult;
        return { seeks: seeksResult.values, speeds: speedsResult.values };
      };

      const hResult = validateLayout("h");
      if (hResult.error) {
        selectLayout("h");
        showToast(hResult.error, "error");
        return;
      }
      const vResult = validateLayout("v");
      if (vResult.error) {
        selectLayout("v");
        showToast(vResult.error, "error");
        return;
      }

      const listChanged =
        hResult.seeks.join(",") !== cfg.seeksH.join(",") ||
        hResult.speeds.join(",") !== cfg.speedsH.join(",") ||
        vResult.seeks.join(",") !== cfg.seeksV.join(",") ||
        vResult.speeds.join(",") !== cfg.speedsV.join(",");
      const checkedSeekOrder = document.querySelector(
        `input[name="${P}-seekOrderV"]:checked`,
      );
      const nextSeekOrderV =
        checkedSeekOrder && checkedSeekOrder.value === "forward"
          ? "forward"
          : "backward";
      const seekOrderChanged = nextSeekOrderV !== cfg.seekOrderV;

      // 更新UI配置（越界或空值回退到默认值，避免写入 NaN）
      const clamp = (v, rule, fallback) =>
        isFinite(v) ? Math.max(rule.min, Math.min(rule.max, v)) : fallback;
      cfg.ui.opacity = clamp(
        parseFloat(opacityInput.value),
        CONFIG.VALIDATORS.opacity,
        CONFIG.DEFAULT_UI.opacity,
      );
      cfg.ui.fontSize = Math.round(
        clamp(
          parseFloat(fontInput.value),
          CONFIG.VALIDATORS.fontSize,
          CONFIG.DEFAULT_UI.fontSize,
        ),
      );
      cfg.ui.btnSize = Math.round(
        clamp(
          parseFloat(btnSizeInput.value),
          CONFIG.VALIDATORS.btnSize,
          CONFIG.DEFAULT_UI.btnSize,
        ),
      );

      // 更新倍速步进
      let stepVal = parseFloat(stepInput.value);
      if (!isFinite(stepVal) || stepVal <= 0)
        stepVal = CONFIG.DEFAULT_SPEED_STEP;
      stepVal = Math.max(
        CONFIG.VALIDATORS.speedStep.min,
        Math.min(CONFIG.VALIDATORS.speedStep.max, Math.round(stepVal * 100) / 100),
      );
      cfg.speedStep = stepVal;

      // 更新定位方式
      const checkedMode = document.querySelector(
        `input[name="${P}-posMode"]:checked`,
      );
      const newMode = checkedMode ? checkedMode.value : cfg.positionMode;
      if (newMode !== cfg.positionMode) {
        cfg.positionMode = newMode;
        if (newMode === "proportional") {
          cfg.proportionalPos = { x: 0.5, y: 0.5 };
        } else {
          if (controls) {
            const rect = controls.getBoundingClientRect();
            lastPos.x = Math.max(0, Math.round((window.innerWidth - rect.width) / 2)) + "px";
            lastPos.y = Math.max(0, Math.round((window.innerHeight - rect.height) / 2)) + "px";
          }
        }
      } else if (cfg.positionMode === "proportional") {
        cfg.proportionalPos.x = Math.max(0, Math.min(1, parseFloat(pxInput.value) || 0.5));
        cfg.proportionalPos.y = Math.max(0, Math.min(1, parseFloat(pyInput.value) || 0.5));
      }

      // 保存并应用
      cfg.seeksH = hResult.seeks;
      cfg.speedsH = hResult.speeds;
      cfg.seeksV = vResult.seeks;
      cfg.speedsV = vResult.speeds;
      cfg.seekOrderV = nextSeekOrderV;
      saveConfig();
      GM_setValue(P + "_pos", JSON.stringify(lastPos));
      applyPosition();

      // 实时应用更改
      applyUiConfig();

      showToast(CONFIG.TEXT.TOAST.SAVED);
      closeSettings(true);
      if (listChanged || seekOrderChanged) rebuildPanel();
    };

    // 键盘支持
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSettings();
      }
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveBtn.click();
      }
    };
    settingsKeyHandler = onKey;
    document.addEventListener("keydown", onKey);

    const overlayHost =
      (isFullscreen && fullscreenContainer) || document.body || document.documentElement;
    overlayHost.appendChild(settingsOverlay);

    // 聚焦第一个输入框
    setTimeout(() => {
      const firstInput = dlg.querySelector("input");
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 100);
  }

  function toggleVisibility() {
    visible = !visible;
    if (controls) controls.style.display = visible ? "flex" : "none";
    if (floatBtn) {
      floatBtn.style.display = visible ? "none" : "block";
      if (!visible) floatBtn.textContent = CONFIG.TEXT.SHOW_PANEL;
    }
    GM_setValue(P + "_visible", visible);
  }

  function setupDrag(el) {
    if (dragDetach) {
      dragDetach();
      dragDetach = null;
    }
    let dragging = false,
      ox = 0,
      oy = 0;
    const start = (cx, cy) => {
      const rect = el.getBoundingClientRect();
      ox = cx - rect.left;
      oy = cy - rect.top;
      dragging = true;
      el.style.cursor = "grabbing";
      el.style.transition = "none";
    };
    const move = (cx, cy) => {
      if (!dragging) return;
      const rect = el.getBoundingClientRect();
      let nx = cx - ox,
        ny = cy - oy;
      nx = Math.max(5, Math.min(nx, innerWidth - rect.width - 5));
      ny = Math.max(5, Math.min(ny, innerHeight - rect.height - 5));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "move";
      el.style.transition = "";
      if (cfg.positionMode === "proportional") {
        const rect = el.getBoundingClientRect();
        const cx = parseFloat(el.style.left) + rect.width / 2;
        const cy = parseFloat(el.style.top) + rect.height / 2;
        cfg.proportionalPos.x = Math.round((cx / window.innerWidth) * 100) / 100;
        cfg.proportionalPos.y = Math.round((cy / window.innerHeight) * 100) / 100;
        cfg.proportionalPos.x = Math.max(0, Math.min(1, cfg.proportionalPos.x));
        cfg.proportionalPos.y = Math.max(0, Math.min(1, cfg.proportionalPos.y));
        saveConfig();
      } else {
        lastPos = { x: el.style.left, y: el.style.top };
        GM_setValue(P + "_pos", JSON.stringify(lastPos));
      }
    };
    const onMouseDown = (e) => {
      if (!isInteractive(e.target)) start(e.clientX, e.clientY);
    };
    const onMouseMove = (e) => move(e.clientX, e.clientY);
    const onMouseUp = () => end();
    const onTouchStart = (e) => {
      if (!isInteractive(e.target) && e.touches.length === 1) {
        e.preventDefault();
        start(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchMove = (e) => {
      if (dragging && e.touches.length === 1) {
        e.preventDefault();
        move(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => end();
    const onSelectStart = (e) => e.preventDefault();

    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    el.addEventListener("selectstart", onSelectStart);

    dragDetach = () => {
      el.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("selectstart", onSelectStart);
    };
  }

  // 重新扫描视频并重建控制器（刷新按钮与设置面板“初始化”按钮共用）
  function reinitialize() {
    L("Reinitialize: start scan");
    // 先确认能找到视频，避免初始化失败时把现有面板也清掉
    if (!findVideo()) {
      L("Reinitialize: no video found");
      showToast(CONFIG.TEXT.TOAST.INIT_FAIL, "error");
      return;
    }
    manualRefresh = true;
    try {
      cleanup();
      init();
    } finally {
      manualRefresh = false;
    }
    if (videoEl && controls) {
      L(`Reinitialize: ok -> ${(videoEl.src || "<inline>").slice(0, 60)}`);
      showToast(CONFIG.TEXT.TOAST.INIT_OK);
    } else {
      L("Reinitialize: no video found");
      showToast(CONFIG.TEXT.TOAST.INIT_FAIL, "error");
    }
  }

  function rebuildPanel() {
    const wasFullscreen = isFullscreen;
    if (isFullscreen) {
      isFullscreen = false;
      originalParent = null;
      fullscreenContainer = null;
    }
    if (controls && controls.parentNode) controls.parentNode.removeChild(controls);
    if (floatBtn && floatBtn.parentNode) floatBtn.parentNode.removeChild(floatBtn);
    const seekNotice = document.getElementById(P + "-seek");
    if (seekNotice && seekNotice.parentNode) seekNotice.parentNode.removeChild(seekNotice);
    controls = null;
    floatBtn = null;
    progress = null;
    curTime = null;
    totalTime = null;
    playBtn = null;
    speedDisplay = null;
    createControls();
    setupListeners();
    if (wasFullscreen) {
      setupFullscreenDetection();
    }
  }

  // ==================== 面板构建 ====================
  function createDragHandle() {
    const handle = document.createElement("div");
    handle.style.cssText =
      "width:40px;height:4px;background:#666;border-radius:2px;cursor:grab;margin:0 auto 6px";
    return handle;
  }

  function createIconButton(text, title, onClick, style = CONFIG.STYLE.SETTING_BTN) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.title = title;
    btn.style.cssText = style;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function toggleRow(id) {
    const row = document.getElementById(id);
    if (row) row.style.display = row.style.display === "none" ? "flex" : "none";
  }

  function createHeader() {
    const headerRow = document.createElement("div");
    headerRow.style.cssText = isVertical
      ? "display:flex;justify-content:center;align-items:center;gap:8px"
      : CONFIG.STYLE.HEADER_ROW;
    headerRow.appendChild(
      createIconButton("⚙", "参数设置 (点击打开)", showSettings),
    );
    headerRow.appendChild(
      createIconButton(
        isVertical ? "↔" : "↕",
        isVertical ? "切换为水平面板" : "切换为垂直面板",
        () => {
          isVertical = !isVertical;
          GM_setValue(P + "_layout", isVertical ? "v" : "h");
          rebuildPanel();
        },
      ),
    );
    if (!isVertical) {
      headerRow.append(
        createIconButton(CONFIG.TEXT.BRIGHTNESS_BTN, "调整视频亮度", () =>
          toggleRow(P + "-brightness"),
        ),
        createIconButton(CONFIG.TEXT.VOLUME_BTN, "调整视频音量", () =>
          toggleRow(P + "-volume"),
        ),
        createIconButton(CONFIG.TEXT.REFRESH_BTN, "重新检测视频", reinitialize),
        createIconButton(
          CONFIG.TEXT.HIDE_PANEL,
          "隐藏面板",
          toggleVisibility,
          CONFIG.STYLE.HIDE_BTN,
        ),
      );
    } else {
      headerRow.appendChild(
        createIconButton("✕", "隐藏面板", toggleVisibility),
      );
    }
    return headerRow;
  }

  function createFloatButton() {
    floatBtn = document.createElement("button");
    floatBtn.id = P + "-hide";
    floatBtn.textContent = CONFIG.TEXT.SHOW_PANEL;
    floatBtn.style.cssText = CONFIG.STYLE.FLOAT_BTN;
    floatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleVisibility();
    });
    document.body.appendChild(floatBtn);
  }

  function restoreVisibility() {
    try {
      if (GM_getValue(P + "_visible") === false) {
        visible = true;
        toggleVisibility();
      }
    } catch (e) {}
  }

  function createProgressInput(compact = false) {
    progress = document.createElement("input");
    progress.type = "range";
    progress.min = "0";
    progress.max = "10000";
    progress.value = "0";
    progress.style.cssText = compact
      ? "display:block;width:100%;min-width:0;margin:0;padding:0;box-sizing:border-box;height:6px;cursor:pointer;accent-color:#4CAF50"
      : CONFIG.STYLE.PROGRESS;
    progress.addEventListener("input", () => {
      if (videoEl && isFinite(videoEl.duration))
        videoEl.currentTime = (progress.value / 10000) * videoEl.duration;
    });
    return progress;
  }

  function createTimeRow(withProgress) {
    const timeRow = document.createElement("div");
    timeRow.style.cssText = withProgress
      ? CONFIG.STYLE.TIME_ROW
      : "text-align:center;width:100%";
    curTime = document.createElement("span");
    curTime.style.cssText = CONFIG.STYLE.CURRENT_TIME;
    curTime.textContent = "00:00";
    totalTime = document.createElement("span");
    totalTime.style.cssText = CONFIG.STYLE.TOTAL_TIME;
    totalTime.textContent = "/ 00:00";
    if (withProgress) {
      timeRow.append(curTime, createProgressInput(), totalTime);
    } else {
      timeRow.append(curTime, totalTime);
    }
    return timeRow;
  }

  function createSpeedColumn() {
    const col = document.createElement("div");
    col.style.cssText = CONFIG.STYLE.VERT_COL;
    cfg.speedsV.forEach((sp) =>
      col.appendChild(createSpeedButton(sp, true)),
    );
    col.append(
      createSpeedAdjustBtn(-1, true),
      createSpeedDisplay(true),
      createSpeedAdjustBtn(1, true),
    );
    return col;
  }

  function createSeekColumn() {
    const col = document.createElement("div");
    col.setAttribute("data-seek", "");
    col.style.cssText = CONFIG.STYLE.VERT_COL;
    // 按方向分组后再决定上下顺序，同一方向内仍保持列表中的顺序
    const backward = cfg.seeksV.filter((v) => v < 0);
    const forward = cfg.seeksV.filter((v) => v > 0);
    const ordered =
      cfg.seekOrderV === "forward"
        ? forward.concat(backward)
        : backward.concat(forward);
    ordered.forEach((val) => col.appendChild(createSeekButton(val, true)));
    return col;
  }

  function createPlayButton(compact) {
    const paused = videoEl ? videoEl.paused : true;
    playBtn = document.createElement("button");
    playBtn.textContent = compact
      ? paused
        ? "▶"
        : "⏸"
      : paused
        ? CONFIG.TEXT.PLAY
        : CONFIG.TEXT.PAUSE;
    playBtn.style.cssText = compact
      ? CONFIG.STYLE.PLAY_BTN_VERT
      : CONFIG.STYLE.PLAY_BTN;
    playBtn.style.background = paused
      ? CONFIG.STYLE.PLAY_COLOR
      : CONFIG.STYLE.PAUSE_COLOR;
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (videoEl) videoEl.paused ? videoEl.play() : videoEl.pause();
    });
    return playBtn;
  }

  // 水平面板的亮度/音量滑块（垂直面板空间有限，不放置）
  function createMediaRows(container) {
    const brightnessRow = document.createElement("div");
    brightnessRow.id = P + "-brightness";
    brightnessRow.style.cssText =
      CONFIG.STYLE.SLIDER_ROW + ";display:none";
    const brightnessInput = document.createElement("input");
    brightnessInput.type = "range";
    brightnessInput.min = CONFIG.VALIDATORS.brightness.min;
    brightnessInput.max = CONFIG.VALIDATORS.brightness.max;
    brightnessInput.step = CONFIG.VALIDATORS.brightness.step;
    brightnessInput.value = cfg.ui.brightness;
    brightnessInput.style.cssText = CONFIG.STYLE.BRIGHTNESS_INPUT;
    const brightnessVal = document.createElement("span");
    brightnessVal.style.cssText = CONFIG.STYLE.BRIGHTNESS_VAL;
    brightnessVal.textContent = Math.round(cfg.ui.brightness * 100) + "%";
    brightnessInput.addEventListener("input", () => {
      const val = parseFloat(brightnessInput.value);
      brightnessVal.textContent = Math.round(val * 100) + "%";
      cfg.ui.brightness = val;
      if (videoEl) videoEl.style.filter = `brightness(${val})`;
    });
    brightnessInput.addEventListener("change", saveConfig);
    const brightnessReset = document.createElement("button");
    brightnessReset.textContent = "重置";
    brightnessReset.style.cssText = CONFIG.STYLE.SLIDER_RESET;
    brightnessReset.title = "重置亮度为100%";
    brightnessReset.addEventListener("click", (e) => {
      e.stopPropagation();
      brightnessInput.value = 1.0;
      brightnessVal.textContent = "100%";
      cfg.ui.brightness = 1.0;
      if (videoEl) videoEl.style.filter = "";
      saveConfig();
    });
    brightnessRow.append(brightnessInput, brightnessVal, brightnessReset);
    container.appendChild(brightnessRow);
    if (videoEl && cfg.ui.brightness !== 1.0)
      videoEl.style.filter = `brightness(${cfg.ui.brightness})`;

    const volumeRow = document.createElement("div");
    volumeRow.id = P + "-volume";
    volumeRow.style.cssText = CONFIG.STYLE.SLIDER_ROW + ";display:none";
    const volumeInput = document.createElement("input");
    volumeInput.type = "range";
    volumeInput.min = CONFIG.VALIDATORS.volume.min;
    volumeInput.max = CONFIG.VALIDATORS.volume.max;
    volumeInput.step = CONFIG.VALIDATORS.volume.step;
    volumeInput.value = cfg.ui.volume;
    volumeInput.style.cssText = CONFIG.STYLE.VOLUME_INPUT;
    const volumeVal = document.createElement("span");
    volumeVal.style.cssText = CONFIG.STYLE.VOLUME_VAL;
    volumeVal.textContent = Math.round(cfg.ui.volume * 100) + "%";
    volumeInput.addEventListener("input", () => {
      const val = parseFloat(volumeInput.value);
      volumeVal.textContent = Math.round(val * 100) + "%";
      cfg.ui.volume = val;
      if (videoEl) {
        videoEl.volume = val;
        if (videoEl.muted && val > 0) videoEl.muted = false;
      }
    });
    volumeInput.addEventListener("change", saveConfig);
    const muteBtn = document.createElement("button");
    muteBtn.id = P + "-mute";
    muteBtn.textContent = videoEl && videoEl.muted ? "恢复" : "静音";
    muteBtn.style.cssText = CONFIG.STYLE.SLIDER_RESET;
    muteBtn.title = "切换静音/恢复";
    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!videoEl) return;
      videoEl.muted = !videoEl.muted;
      muteBtn.textContent = videoEl.muted ? "恢复" : "静音";
    });
    volumeRow.append(volumeInput, volumeVal, muteBtn);
    container.appendChild(volumeRow);
    if (videoEl && cfg.ui.volume !== 1.0) videoEl.volume = cfg.ui.volume;
  }

  function buildHorizontalContent(content) {
    const make = {
      time: () => createTimeRow(true),
      seek: () => {
        const row = document.createElement("div");
        row.setAttribute("data-seek", "");
        row.style.cssText = CONFIG.STYLE.SEEK_ROW;
        renderSeekRow(row);
        return row;
      },
      speed: () => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap";
        renderSpeedRow(row);
        return row;
      },
      play: () => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;justify-content:flex-end";
        row.appendChild(createPlayButton(false));
        return row;
      },
    };
    const cache = {};
    const get = (key) => cache[key] || (cache[key] = make[key]());
    const order = CONFIG.DEFAULT_ORDER_H;

    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      if (key === "speed" && order[i + 1] === "play") {
        // 倍速与播放相邻时合并到同一行，保持原面板的紧凑布局
        const row = document.createElement("div");
        row.style.cssText = CONFIG.STYLE.ACTION_ROW;
        row.append(get("speed"), get("play"));
        content.appendChild(row);
        i++;
      } else if (key === "speed" || key === "play") {
        const row = document.createElement("div");
        row.style.cssText = CONFIG.STYLE.ACTION_ROW;
        row.appendChild(get(key));
        content.appendChild(row);
      } else {
        content.appendChild(get(key));
      }
    }
  }

  function buildVerticalContent(content) {
    const make = {
      progress: () => {
        const row = document.createElement("div");
        row.style.cssText =
          "width:100%;padding:2px 0;box-sizing:border-box;overflow:hidden";
        row.appendChild(createProgressInput(true));
        return row;
      },
      time: () => createTimeRow(false),
      speed: () => createSpeedColumn(),
      seek: () => createSeekColumn(),
      play: () => createPlayButton(true),
    };
    const order = CONFIG.DEFAULT_ORDER_V;

    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      const next = order[i + 1];
      if (
        (key === "speed" && next === "seek") ||
        (key === "seek" && next === "speed")
      ) {
        // 倍速与快进相邻时并排成两列，顺序决定左右位置
        const grid = document.createElement("div");
        grid.style.cssText =
          "display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%";
        grid.append(make[key](), make[next]());
        content.appendChild(grid);
        i++;
      } else {
        content.appendChild(make[key]());
      }
    }
  }

  function createControls() {
    controls = document.createElement("div");
    controls.id = P + "-cont";
    controls.style.cssText = isVertical
      ? CONFIG.STYLE.PANEL_VERT
      : CONFIG.STYLE.PANEL;
    loadSavedPos();
    applyUiConfig();

    controls.appendChild(createDragHandle());
    controls.appendChild(createHeader());
    if (!isVertical) createMediaRows(controls);

    const content = document.createElement("div");
    content.style.cssText =
      "display:flex;flex-direction:column;width:100%;" +
      (isVertical ? "gap:6px;align-items:center" : "gap:10px");
    if (isVertical) buildVerticalContent(content);
    else buildHorizontalContent(content);
    controls.appendChild(content);

    document.body.appendChild(controls);
    createFloatButton();
    restoreVisibility();
    applyPosition();
    setupDrag(controls);
  }

  // ==================== 视频事件绑定 ====================
  function updateSpeedHighlight() {
    updateSpeedDisplay();
    if (!controls || !videoEl) return;
    const rate = videoEl.playbackRate;
    controls.querySelectorAll("button[data-speed]").forEach((btn) => {
      const sp = parseFloat(btn.dataset.speed);
      btn.style.background =
        Math.abs(rate - sp) < 0.01
          ? CONFIG.STYLE.SPEED_BTN_ACTIVE
          : "#2a2a2a";
    });
  }

  function syncPlayButton() {
    if (!playBtn || !videoEl) return;
    const paused = videoEl.paused;
    playBtn.textContent = isVertical
      ? paused
        ? "▶"
        : "⏸"
      : paused
        ? CONFIG.TEXT.PLAY
        : CONFIG.TEXT.PAUSE;
    playBtn.style.background = paused
      ? CONFIG.STYLE.PLAY_COLOR
      : CONFIG.STYLE.PAUSE_COLOR;
  }

  function setupListeners() {
    if (!videoEl) return;
    // 同一视频反复绑定时先解绑旧监听，避免重复触发
    if (listenerAC) listenerAC.abort();
    listenerAC = new AbortController();
    const opt = { signal: listenerAC.signal };
    videoEl.addEventListener(
      "loadedmetadata",
      () => {
        L("metadata loaded");
        updateTotalTime();
        updateProgress();
        updateSpeedHighlight();
      },
      opt,
    );
    videoEl.addEventListener(
      "durationchange",
      () => {
        L("duration changed");
        updateTotalTime();
      },
      opt,
    );
    videoEl.addEventListener("timeupdate", updateProgress, opt);
    videoEl.addEventListener("play", syncPlayButton, opt);
    videoEl.addEventListener("pause", syncPlayButton, opt);
    videoEl.addEventListener("ratechange", updateSpeedHighlight, opt);
    videoEl.addEventListener(
      "volumechange",
      () => {
        if (!videoEl) return;
        const muteBtn = document.getElementById(P + "-mute");
        if (muteBtn) muteBtn.textContent = videoEl.muted ? "恢复" : "静音";
      },
      opt,
    );
  }

  // ==================== 清理与初始化 ====================
  function cleanup() {
    L("Cleaning");
    if (fullscreenObserver) {
      fullscreenObserver.disconnect();
      fullscreenObserver = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (videoCheckTimer) {
      clearTimeout(videoCheckTimer);
      videoCheckTimer = null;
    }
    if (dragDetach) {
      dragDetach();
      dragDetach = null;
    }
    if (listenerAC) {
      listenerAC.abort();
      listenerAC = null;
    }
    if (seekTimer) {
      clearTimeout(seekTimer);
      seekTimer = null;
    }
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const toast = document.getElementById(P + "-toast");
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
    totalSeek = 0;
    isFullscreen = false;
    originalParent = null;
    fullscreenContainer = null;
    if (settingsOverlay && settingsOverlay.parentNode)
      settingsOverlay.parentNode.removeChild(settingsOverlay);
    if (controls && controls.parentNode)
      controls.parentNode.removeChild(controls);
    if (floatBtn && floatBtn.parentNode)
      floatBtn.parentNode.removeChild(floatBtn);
    if (settingsKeyHandler) {
      document.removeEventListener("keydown", settingsKeyHandler);
      settingsKeyHandler = null;
    }
    videoEl = null;
    controls = null;
    progress = null;
    curTime = null;
    totalTime = null;
    playBtn = null;
    floatBtn = null;
    speedDisplay = null;
    settingsOverlay = null;
  }

  function init() {
    if (document.getElementById(P + "-cont")) return;
    videoEl = findVideo();
    if (!videoEl) {
      L("No video");
      ensureObserver();
      return;
    }
    L(`Video: ${(videoEl.src || "").slice(0, 50) || "<inline>"}`);
    createControls();
    setupListeners();
    setupFullscreenDetection();
    // 如果视频元数据已经加载完成，立即更新总时长
    if (videoEl.readyState >= 1) {
      updateTotalTime();
      updateProgress();
      updateSpeedHighlight();
    }
    ensureObserver();
  }

  // DOM 变动频繁时做防抖，避免每次 mutation 都全量扫描视频
  function scheduleVideoCheck() {
    if (videoCheckTimer) return;
    videoCheckTimer = setTimeout(() => {
      videoCheckTimer = null;
      if (manualRefresh) return;
      if (!videoEl || !document.body.contains(videoEl)) {
        // 无视频页面也会频繁触发 mutation，限制为最多 1 秒扫描一次
        const now = Date.now();
        if (now - lastVideoScan < 1000) return;
        lastVideoScan = now;
        const newVid = findVideo();
        if (newVid && newVid !== videoEl) {
          L("New video detected");
          cleanup();
          setTimeout(init, 300);
        }
      }
    }, 500);
  }

  // 保证 MutationObserver 存在（cleanup 之后重建，SPA 切换后也不会失效）
  function ensureObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver(scheduleVideoCheck);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    const boot = () => {
      ensureObserver();
      setTimeout(init, CONFIG.INIT_DELAY);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
    document.addEventListener("fullscreenchange", handleNativeFullscreen);
    document.addEventListener("webkitfullscreenchange", handleNativeFullscreen);
    window.addEventListener("resize", () => {
      if (!controls) return;
      if (isFullscreen) repositionControlsInFullscreen();
      else applyPosition();
    });
    window.addEventListener("beforeunload", cleanup);
  }

  start();
})();