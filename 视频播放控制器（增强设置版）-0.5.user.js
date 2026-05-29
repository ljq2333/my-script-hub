// ==UserScript==
// @name         视频播放控制器（增强设置版）
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  可拖拽控制面板，自定义倍速/快进参数，文字样式一键修改（增强设置版）
// @author       You
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ==================== 自定义配置（可随意修改） ====================
  const CONFIG = {
    // 文字标签
    TEXT: {
      PLAY: "Play",
      PAUSE: "Pause",
      HIDE_PANEL: "Hide",
      SHOW_PANEL: "Show",
      SETTINGS_TITLE: "⚙️ 参数设置",
      SPEED_LABEL: "播放倍速",
      SEEK_LABEL: "快进/快退（秒）",
      UI_LABEL: "界面样式",
      SAVE: "保存配置",
      CANCEL: "取消",
      RESET: "恢复默认",
      ADD: "+ 添加",
      REMOVE: "✕",
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
      TOAST: {
        SAVED: "✓ 配置已保存",
        RESET: "✓ 已恢复默认值",
        INVALID: "⚠ 存在无效值，请修正后保存",
      },
    },
    // 默认配置
    DEFAULT_SPEEDS: [3.0, 2.5, 2.0, 1.5, 1.25, 1.0],
    DEFAULT_SEEKS: [-600, -60, -10, 10, 60, 600],
    DEFAULT_UI: {
      opacity: 0.85,
      fontSize: 14,
      panelX: "10px",
      panelY: "10px",
      brightness: 1.0,
      volume: 1.0,
      btnSize: 14,
    },
    // 验证规则
    VALIDATORS: {
      speed: { min: 0.1, max: 16, step: 0.05, type: "number" },
      seek: { min: -3600, max: 3600, step: 1, type: "integer" },
      opacity: { min: 0.3, max: 1, step: 0.05 },
      fontSize: { min: 12, max: 24, step: 1 },
      brightness: { min: 0.1, max: 2, step: 0.05 },
      volume: { min: 0, max: 1, step: 0.05 },
      btnSize: { min: 10, max: 22, step: 1 },
    },
    // 最小视频尺寸
    MIN_VIDEO_SIZE: 200,
    // 脚本标识前缀
    PREFIX: "VideoCtrl",
    // 延迟初始化（ms）
    INIT_DELAY: 800,
    // UI样式
    STYLE: {
      PANEL:
        'position:fixed;z-index:99999;background:rgba(0,0,0,.85);color:#fff;padding:12px;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;cursor:move;user-select:none;display:flex;flex-direction:column;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);transition:opacity .2s',
      PANEL_VERT:
        'position:fixed;z-index:99999;background:rgba(0,0,0,.85);color:#fff;padding:8px;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;cursor:move;user-select:none;display:flex;flex-direction:column;gap:6px;box-shadow:0 4px 20px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);transition:opacity .2s;width:85px;align-items:center',
      FLOAT_BTN:
        "position:fixed;z-index:99998;right:15px;bottom:15px;padding:8px 16px;border:1px solid #555;border-radius:6px;background:#555;color:#fff;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.3);display:none",
      HEADER_ROW:
        "display:flex;justify-content:space-between;align-items:center;margin-bottom:-4px",
      SETTING_BTN:
        "background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:0 2px;line-height:1",
      HIDE_BTN:
        "padding:3px 10px;border:1px solid #666;border-radius:4px;background:#444;color:#ddd;cursor:pointer;font-size:12px",
      TIME_ROW: "display:flex;align-items:center;gap:8px;min-width:320px",
      CURRENT_TIME: "min-width:45px",
      TOTAL_TIME: "color:#aaa",
      PROGRESS: "flex:1;height:6px;cursor:pointer;accent-color:#4CAF50",
      SEEK_ROW: "display:flex;justify-content:center;gap:6px;flex-wrap:wrap",
      SEEK_BTN:
        "padding:4px 10px;border:1px solid #555;border-radius:5px;background:#2a2a2a;color:#fff;cursor:pointer;transition:background .2s;font-size:13px",
      SEEK_BTN_HOVER: "#444",
      ACTION_ROW:
        "display:flex;justify-content:flex-end;align-items:center;gap:6px;flex-wrap:wrap",
      SPEED_BTN:
        "padding:3px 8px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#fff;cursor:pointer;font-size:12px;min-width:36px",
      SPEED_BTN_ACTIVE: "#2196F3",
      PLAY_BTN:
        "padding:5px 14px;border:none;border-radius:5px;color:#fff;cursor:pointer;font-weight:500",
      PLAY_COLOR: "#28a745",
      PAUSE_COLOR: "#dc3545",
      SEEK_NOTICE:
        "position:absolute;top:-30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:4px 12px;border-radius:6px;z-index:999999;font-size:14px;opacity:0;transition:opacity .2s;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)",
      OVERLAY:
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:1000000;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(2px)",
      DIALOG:
        "background:#1a1a2e;color:#eee;padding:20px;border-radius:12px;min-width:420px;max-width:90vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,.6);border:1px solid #333",
      DIALOG_HEADER:
        "display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid #333",
      DIALOG_TITLE: "margin:0;font-size:18px;color:#fff",
      DIALOG_CLOSE:
        "background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;padding:0 5px",
      SECTION:
        "margin-bottom:18px;padding:12px;background:#252540;border-radius:8px",
      SECTION_TITLE:
        "margin:0 0 10px;font-size:15px;color:#7ed6df;display:flex;align-items:center;gap:6px",
      LIST_CONTAINER: "display:flex;flex-wrap:wrap;gap:8px;min-height:36px",
      LIST_ITEM:
        "display:flex;align-items:center;gap:4px;padding:4px 8px;background:#333;border-radius:5px;border:1px solid #444",
      LIST_INPUT:
        "width:60px;padding:3px 6px;background:#222;border:1px solid #555;border-radius:3px;color:#fff;font-size:13px;text-align:center",
      LIST_INPUT_INVALID: "border-color:#e74c3c;background:#3a2525",
      LIST_BTN:
        "padding:2px 6px;background:#e74c3c;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:12px;line-height:1",
      ADD_BTN:
        "padding:4px 10px;background:#3498db;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:13px;margin-top:6px",
      ADD_BTN_HOVER: "#2980b9",
      UI_ROW: "display:flex;align-items:center;gap:12px;margin:8px 0",
      UI_LABEL: "min-width:70px;color:#aaa;font-size:13px",
      UI_INPUT:
        "width:80px;padding:4px 8px;background:#222;border:1px solid #555;border-radius:4px;color:#fff;font-size:13px",
      UI_RANGE: "flex:1;accent-color:#3498db",
      BTN_ROW:
        "display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:15px;border-top:1px solid #333",
      BTN_GROUP: "display:flex;gap:8px",
      SAVE_BTN:
        "padding:8px 20px;background:#27ae60;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:500",
      SAVE_BTN_HOVER: "#219653",
      CANCEL_BTN:
        "padding:8px 20px;background:#555;border:none;border-radius:6px;color:#fff;cursor:pointer",
      RESET_BTN:
        "padding:8px 16px;background:#e67e22;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px",
      TOAST:
        "position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(39,174,96,.95);color:#fff;padding:10px 20px;border-radius:8px;z-index:1000001;font-size:14px;box-shadow:0 4px 15px rgba(0,0,0,.3);opacity:0;transition:opacity .3s;pointer-events:none",
      BRIGHTNESS_ROW: "display:flex;align-items:center;gap:8px;padding:6px 0",
      BRIGHTNESS_INPUT: "flex:1;height:6px;cursor:pointer;accent-color:#FFD700",
      BRIGHTNESS_VAL:
        "min-width:40px;text-align:right;color:#FFD700;font-size:13px",
      BRIGHTNESS_RESET:
        "padding:2px 8px;background:#555;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;line-height:1.4",
      VOLUME_ROW: "display:flex;align-items:center;gap:8px;padding:6px 0",
      VOLUME_INPUT: "flex:1;height:6px;cursor:pointer;accent-color:#3498db",
      VOLUME_VAL:
        "min-width:40px;text-align:right;color:#3498db;font-size:13px",
      VOLUME_RESET:
        "padding:2px 8px;background:#555;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;line-height:1.4",
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
    actionDiv = null,
    curSpeedBtn = null,
    dragging = false,
    offsetX,
    offsetY,
    visible = true,
    lastPos = { x: "10px", y: "10px" },
    exists = false,
    seekTimer = null,
    totalSeek = 0,
    observer = null,
    settingsOverlay = null,
    dragHandlers = null,
    settingsKeyHandler = null,
    isVertical = false;
  let cfg = {
    speeds: [...CONFIG.DEFAULT_SPEEDS],
    seeks: [...CONFIG.DEFAULT_SEEKS],
    ui: { ...CONFIG.DEFAULT_UI },
  };

  // ==================== 工具函数 ====================
  function loadConfig() {
    try {
      const s = GM_getValue(P + "_cfg");
      if (s) {
        const p = JSON.parse(s);
        cfg.speeds = Array.isArray(p.speeds)
          ? p.speeds
          : [...CONFIG.DEFAULT_SPEEDS];
        cfg.seeks = Array.isArray(p.seeks)
          ? p.seeks
          : [...CONFIG.DEFAULT_SEEKS];
        cfg.ui = { ...CONFIG.DEFAULT_UI, ...(p.ui || {}) };
      }
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
      curTime.textContent = formatTime(videoEl.currentTime);
    }
  }

  function isInteractive(el) {
    return (
      el.closest('button, input, select, textarea, a, [role="button"]') !== null
    );
  }

  function showToast(msg, type = "success") {
    let toast = document.getElementById(P + "-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = P + "-toast";
      toast.style.cssText = CONFIG.STYLE.TOAST;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background =
      type === "error" ? "rgba(231,76,60,.95)" : "rgba(39,174,96,.95)";
    toast.style.opacity = "1";
    setTimeout(() => {
      toast.style.opacity = "0";
    }, 2000);
  }

  function validateNumber(val, rules) {
    const num = rules.type === "integer" ? parseInt(val, 10) : parseFloat(val);
    if (isNaN(num)) return { valid: false, value: null };
    if (num < rules.min || num > rules.max) return { valid: false, value: num };
    return {
      valid: true,
      value: rules.type === "integer" ? Math.round(num) : num,
    };
  }

  // ==================== 视频查找 ====================
  function findVideo() {
    let candidates = [];
    const collect = (doc, ctxScore = 0) => {
      try {
        doc.querySelectorAll("video").forEach((v) => {
          if (
            v.offsetWidth < CONFIG.MIN_VIDEO_SIZE ||
            v.offsetHeight < CONFIG.MIN_VIDEO_SIZE
          )
            return;
          if (!v.src && !v.querySelector("source")) return;
          let score = ctxScore;
          if (v.hasAttribute("controls")) score += 10;
          if (v.hasAttribute("autoplay")) score += 5;
          if (v.paused === false) score += 15;
          if (v === document.querySelector("video:focus")) score += 20;
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
  function renderSeekRow(container) {
    container.innerHTML = "";
    cfg.seeks.forEach((val) => {
      const btn = document.createElement("button");
      btn.textContent =
        CONFIG.TEXT.SEEK_LABELS[val] ||
        (val >= 0 ? "+" + val + "s" : val + "s");
      btn.style.cssText = CONFIG.STYLE.SEEK_BTN;
      btn.onmouseenter = () =>
        (btn.style.background = CONFIG.STYLE.SEEK_BTN_HOVER);
      btn.onmouseleave = () => (btn.style.background = "#2a2a2a");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (videoEl) {
          videoEl.currentTime = Math.max(0, videoEl.currentTime + val);
          showSeek(val);
        }
      });
      container.appendChild(btn);
    });
  }

  function renderSpeedRow(container) {
    container.innerHTML = "";
    cfg.speeds.forEach((sp) => {
      const btn = document.createElement("button");
      btn.textContent = sp + "x";
      btn.dataset.speed = sp;
      btn.style.cssText = CONFIG.STYLE.SPEED_BTN;
      if (videoEl && Math.abs(videoEl.playbackRate - sp) < 0.01) {
        btn.style.background = CONFIG.STYLE.SPEED_BTN_ACTIVE;
        curSpeedBtn = btn;
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (videoEl) {
          videoEl.playbackRate = sp;
          if (curSpeedBtn) curSpeedBtn.style.background = "#2a2a2a";
          btn.style.background = CONFIG.STYLE.SPEED_BTN_ACTIVE;
          curSpeedBtn = btn;
        }
      });
      container.appendChild(btn);
    });
  }

  // ============ 增强版设置面板 ============
  function showSettings() {
    if (settingsOverlay) return; // 防止重复打开

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

    // 倍速设置区域
    const speedSection = document.createElement("div");
    speedSection.style.cssText = CONFIG.STYLE.SECTION;
    const speedTitle = document.createElement("h4");
    speedTitle.textContent = "🎬 " + CONFIG.TEXT.SPEED_LABEL;
    speedTitle.style.cssText = CONFIG.STYLE.SECTION_TITLE;
    const speedList = document.createElement("div");
    speedList.style.cssText = CONFIG.STYLE.LIST_CONTAINER;
    speedList.dataset.type = "speed";

    // 渲染倍速列表项
    const renderListItem = (val, type, container) => {
      const item = document.createElement("div");
      item.style.cssText = CONFIG.STYLE.LIST_ITEM;

      const input = document.createElement("input");
      input.type = "number";
      input.value = val;
      input.style.cssText = CONFIG.STYLE.LIST_INPUT;
      const rules = CONFIG.VALIDATORS[type];
      input.min = rules.min;
      input.max = rules.max;
      input.step = rules.step;

      // 实时验证
      input.addEventListener("input", () => {
        const result = validateNumber(input.value, rules);
        if (!result.valid) {
          input.style.cssText =
            CONFIG.STYLE.LIST_INPUT + CONFIG.STYLE.LIST_INPUT_INVALID;
          input.title = `范围: ${rules.min}~${rules.max}`;
        } else {
          input.style.cssText = CONFIG.STYLE.LIST_INPUT;
          input.title = "";
        }
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = CONFIG.TEXT.REMOVE;
      removeBtn.style.cssText = CONFIG.STYLE.LIST_BTN;
      removeBtn.title = "删除此项";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        item.remove();
      });

      item.append(input, removeBtn);
      container.appendChild(item);
      return input;
    };

    cfg.speeds.forEach((v) => renderListItem(v, "speed", speedList));

    const addSpeedBtn = document.createElement("button");
    addSpeedBtn.textContent = CONFIG.TEXT.ADD;
    addSpeedBtn.style.cssText = CONFIG.STYLE.ADD_BTN;
    addSpeedBtn.onmouseenter = () =>
      (addSpeedBtn.style.background = CONFIG.STYLE.ADD_BTN_HOVER);
    addSpeedBtn.onmouseleave = () => (addSpeedBtn.style.background = "#3498db");
    addSpeedBtn.addEventListener("click", () => {
      const input = renderListItem(1.0, "speed", speedList);
      input.focus();
      input.select();
    });

    speedSection.append(speedTitle, speedList, addSpeedBtn);

    // 快进设置区域
    const seekSection = document.createElement("div");
    seekSection.style.cssText = CONFIG.STYLE.SECTION;
    const seekTitle = document.createElement("h4");
    seekTitle.textContent = "⏭️ " + CONFIG.TEXT.SEEK_LABEL;
    seekTitle.style.cssText = CONFIG.STYLE.SECTION_TITLE;
    const seekList = document.createElement("div");
    seekList.style.cssText = CONFIG.STYLE.LIST_CONTAINER;
    seekList.dataset.type = "seek";

    cfg.seeks.forEach((v) => renderListItem(v, "seek", seekList));

    const addSeekBtn = document.createElement("button");
    addSeekBtn.textContent = CONFIG.TEXT.ADD;
    addSeekBtn.style.cssText = CONFIG.STYLE.ADD_BTN;
    addSeekBtn.onmouseenter = () =>
      (addSeekBtn.style.background = CONFIG.STYLE.ADD_BTN_HOVER);
    addSeekBtn.onmouseleave = () => (addSeekBtn.style.background = "#3498db");
    addSeekBtn.addEventListener("click", () => {
      const input = renderListItem(10, "seek", seekList);
      input.focus();
      input.select();
    });

    seekSection.append(seekTitle, seekList, addSeekBtn);

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
      if (controls) controls.style.background = `rgba(0,0,0,${val})`;
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
        if (controls) controls.style.fontSize = val + "px";
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
      if (controls && isVertical) {
        controls.querySelectorAll("button").forEach(b => {
          b.style.fontSize = val + "px";
        });
        const panelWidth = Math.max(85, val * 6 + 20);
        controls.style.width = panelWidth + "px";
      }
    });
    btnSizeRow.append(btnSizeLabel, btnSizeInput, btnSizeVal);

    // 位置重置
    const posRow = document.createElement("div");
    posRow.style.cssText = CONFIG.STYLE.UI_ROW;
    const posBtn = document.createElement("button");
    posBtn.textContent = "📍 重置面板位置";
    posBtn.style.cssText = CONFIG.STYLE.ADD_BTN.replace("margin-top:6px", "");
    posBtn.style.width = "100%";
    posBtn.addEventListener("click", () => {
      lastPos = { x: CONFIG.DEFAULT_UI.panelX, y: CONFIG.DEFAULT_UI.panelY };
      if (controls) {
        controls.style.left = lastPos.x;
        controls.style.top = lastPos.y;
        GM_setValue(P + "_pos", JSON.stringify(lastPos));
        showToast("面板位置已重置");
      }
    });
    posRow.appendChild(posBtn);

    uiSection.append(uiTitle, opacityRow, fontRow, btnSizeRow, posRow);

    // 按钮区域
    const btnRow = document.createElement("div");
    btnRow.style.cssText = CONFIG.STYLE.BTN_ROW;

    const resetBtn = document.createElement("button");
    resetBtn.textContent = CONFIG.TEXT.RESET;
    resetBtn.style.cssText = CONFIG.STYLE.RESET_BTN;
    resetBtn.addEventListener("click", () => {
      if (confirm("确定要恢复所有设置为默认值吗？")) {
        cfg = {
          speeds: [...CONFIG.DEFAULT_SPEEDS],
          seeks: [...CONFIG.DEFAULT_SEEKS],
          ui: { ...CONFIG.DEFAULT_UI },
        };
        // 实时更新面板
        if (controls) {
          controls.style.background = `rgba(0,0,0,${cfg.ui.opacity})`;
          controls.style.fontSize = cfg.ui.fontSize + "px";
          const seekRow = controls.querySelector("[data-seek]");
          if (seekRow) renderSeekRow(seekRow);
          if (actionDiv) renderSpeedRow(actionDiv);
        }
        saveConfig();
        showToast(CONFIG.TEXT.TOAST.RESET);
        // 重新渲染设置面板
        dlg.querySelector('[data-type="speed"]').innerHTML = "";
        dlg.querySelector('[data-type="seek"]').innerHTML = "";
        cfg.speeds.forEach((v) =>
          renderListItem(v, "speed", dlg.querySelector('[data-type="speed"]')),
        );
        cfg.seeks.forEach((v) =>
          renderListItem(v, "seek", dlg.querySelector('[data-type="seek"]')),
        );
        opacityInput.value = cfg.ui.opacity;
        opacityVal.textContent = Math.round(cfg.ui.opacity * 100) + "%";
        fontInput.value = cfg.ui.fontSize;
        btnSizeInput.value = cfg.ui.btnSize;
        btnSizeVal.textContent = cfg.ui.btnSize + "px";
        if (controls && isVertical) {
          controls.querySelectorAll("button").forEach(b => {
            b.style.fontSize = cfg.ui.btnSize + "px";
          });
          const panelWidth = Math.max(85, cfg.ui.btnSize * 6 + 20);
          controls.style.width = panelWidth + "px";
        }
      }
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
    btnRow.append(resetBtn, btnGroup);

    // 组装对话框
    dlg.append(header, speedSection, seekSection, uiSection, btnRow);
    settingsOverlay.appendChild(dlg);

    // 关闭逻辑
    const closeSettings = () => {
      if (settingsKeyHandler) {
        document.removeEventListener("keydown", settingsKeyHandler);
        settingsKeyHandler = null;
      }
      if (settingsOverlay && settingsOverlay.parentNode) {
        settingsOverlay.parentNode.removeChild(settingsOverlay);
        settingsOverlay = null;
      }
    };

    closeBtn.onclick = closeSettings;
    cancelBtn.onclick = closeSettings;
    settingsOverlay.addEventListener("click", (e) => {
      if (e.target === settingsOverlay) closeSettings();
    });

    // 保存逻辑
    saveBtn.onclick = () => {
      // 收集并验证倍速
      const speedInputs = dlg
        .querySelector('[data-type="speed"]')
        .querySelectorAll("input");
      const newSpeeds = [];
      let hasError = false;
      speedInputs.forEach((input) => {
        const result = validateNumber(input.value, CONFIG.VALIDATORS.speed);
        if (result.valid) newSpeeds.push(result.value);
        else {
          input.style.cssText =
            CONFIG.STYLE.LIST_INPUT + CONFIG.STYLE.LIST_INPUT_INVALID;
          hasError = true;
        }
      });

      // 收集并验证快进
      const seekInputs = dlg
        .querySelector('[data-type="seek"]')
        .querySelectorAll("input");
      const newSeeks = [];
      seekInputs.forEach((input) => {
        const result = validateNumber(input.value, CONFIG.VALIDATORS.seek);
        if (result.valid) newSeeks.push(result.value);
        else {
          input.style.cssText =
            CONFIG.STYLE.LIST_INPUT + CONFIG.STYLE.LIST_INPUT_INVALID;
          hasError = true;
        }
      });

      if (hasError) {
        showToast(CONFIG.TEXT.TOAST.INVALID, "error");
        return;
      }

      // 更新配置
      cfg.speeds = newSpeeds.sort((a, b) => b - a); // 降序排列
      cfg.seeks = newSeeks.sort((a, b) => a - b); // 升序排列
      cfg.ui.opacity = parseFloat(opacityInput.value);
      cfg.ui.fontSize = parseInt(fontInput.value);
      cfg.ui.btnSize = parseInt(btnSizeInput.value);

      // 保存并应用
      saveConfig();
      GM_setValue(P + "_pos", JSON.stringify(lastPos));

      // 实时应用更改
      if (controls) {
        controls.style.background = `rgba(0,0,0,${cfg.ui.opacity})`;
        controls.style.fontSize = cfg.ui.fontSize + "px";
        const seekRow = controls.querySelector("[data-seek]");
        if (seekRow) renderSeekRow(seekRow);
        if (actionDiv) renderSpeedRow(actionDiv);
      }
      if (controls && isVertical) {
        controls.querySelectorAll("button").forEach(b => {
          b.style.fontSize = cfg.ui.btnSize + "px";
        });
        const panelWidth = Math.max(85, cfg.ui.btnSize * 6 + 20);
        controls.style.width = panelWidth + "px";
      }

      showToast(CONFIG.TEXT.TOAST.SAVED);
      closeSettings();
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

    document.body.appendChild(settingsOverlay);

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
    controls.style.display = visible ? "flex" : "none";
    floatBtn.style.display = visible ? "none" : "block";
    if (!visible) floatBtn.textContent = CONFIG.TEXT.SHOW_PANEL;
    GM_setValue(P + "_visible", visible);
  }

  function rebuildPanel() {
    if (controls && controls.parentNode) controls.parentNode.removeChild(controls);
    if (floatBtn && floatBtn.parentNode) floatBtn.parentNode.removeChild(floatBtn);
    const seekNotice = document.getElementById(P + "-seek");
    if (seekNotice && seekNotice.parentNode) seekNotice.parentNode.removeChild(seekNotice);
    if (dragHandlers) {
      document.removeEventListener("mousemove", dragHandlers.onMouseMove);
      document.removeEventListener("mouseup", dragHandlers.endDrag);
      document.removeEventListener("touchmove", dragHandlers.onTouchMove);
      document.removeEventListener("touchend", dragHandlers.endDrag);
      dragHandlers = null;
    }
    controls = null;
    floatBtn = null;
    progress = null;
    curTime = null;
    totalTime = null;
    playBtn = null;
    actionDiv = null;
    curSpeedBtn = null;
    createControls();
    setupListeners();
  }

  function createControls() {
    if (isVertical) {
      controls = document.createElement("div");
      controls.id = P + "-cont";
      const panelWidth = Math.max(85, cfg.ui.btnSize * 6 + 20);
      controls.style.cssText = CONFIG.STYLE.PANEL_VERT.replace(
        "rgba(0,0,0,.85)",
        `rgba(0,0,0,${cfg.ui.opacity})`,
      ).replace("font-size:14px", `font-size:${cfg.ui.fontSize}px`).replace("width:85px", `width:${panelWidth}px`);
      try {
        const s = GM_getValue(P + "_pos");
        if (s) lastPos = JSON.parse(s);
      } catch (e) {}
      controls.style.left = lastPos.x;
      controls.style.top = lastPos.y;

      const dragHandle = document.createElement("div");
      dragHandle.style.cssText = "width:40px;height:4px;background:#666;border-radius:2px;cursor:grab;margin:0 auto 6px";
      controls.appendChild(dragHandle);

      const headerRow = document.createElement("div");
      headerRow.style.cssText = "display:flex;justify-content:center;align-items:center;gap:8px";

      const setBtn = document.createElement("button");
      setBtn.innerHTML = "&#9881;";
      setBtn.title = "参数设置 (点击打开)";
      setBtn.style.cssText = CONFIG.STYLE.SETTING_BTN;
      setBtn.addEventListener("click", (e) => { e.stopPropagation(); showSettings(); });

      const layoutBtn = document.createElement("button");
      layoutBtn.textContent = "↔";
      layoutBtn.title = "切换为水平面板";
      layoutBtn.style.cssText = CONFIG.STYLE.SETTING_BTN;
      layoutBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        isVertical = false;
        GM_setValue(P + "_layout", "h");
        rebuildPanel();
      });

      const hideBtn = document.createElement("button");
      hideBtn.innerHTML = "&#10005;";
      hideBtn.title = "隐藏面板";
      hideBtn.style.cssText = CONFIG.STYLE.SETTING_BTN;
      hideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleVisibility();
      });

      headerRow.append(setBtn, layoutBtn, hideBtn);
      controls.appendChild(headerRow);

      const contentWrap = document.createElement("div");
      contentWrap.style.cssText = `display:flex;flex-direction:column;gap:6px;width:100%;align-items:center`;

      const progRow = document.createElement("div");
      progRow.style.cssText = "width:100%;padding:2px 0";
      progress = document.createElement("input");
      progress.type = "range";
      progress.min = "0";
      progress.max = "10000";
      progress.value = "0";
      progress.style.cssText = "width:100%;height:3px;cursor:pointer;accent-color:#4CAF50;margin:0";
      progress.addEventListener("input", () => {
        if (videoEl && isFinite(videoEl.duration))
          videoEl.currentTime = (progress.value / 10000) * videoEl.duration;
      });
      progRow.appendChild(progress);
      contentWrap.appendChild(progRow);

      curTime = document.createElement("div");
      curTime.style.cssText = "text-align:center;font-size:11px;color:#ccc;width:100%";
      curTime.textContent = "00:00";
      contentWrap.appendChild(curTime);

      const btnGrid = document.createElement("div");
      btnGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%";

      const speedCol = document.createElement("div");
      speedCol.style.cssText = "display:flex;flex-direction:column;gap:3px";
      [...cfg.speeds].reverse().forEach((sp) => {
        const btn = document.createElement("button");
        btn.textContent = sp + "x";
        btn.dataset.speed = sp;
        btn.style.cssText = "padding:4px 0;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#fff;cursor:pointer;font-size:" + cfg.ui.btnSize + "px;text-align:center;flex-shrink:0";
        if (videoEl && Math.abs(videoEl.playbackRate - sp) < 0.01) {
          btn.style.background = "#2196F3";
          curSpeedBtn = btn;
        }
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (videoEl) {
            videoEl.playbackRate = sp;
            if (curSpeedBtn) curSpeedBtn.style.background = "#2a2a2a";
            btn.style.background = "#2196F3";
            curSpeedBtn = btn;
          }
        });
        speedCol.appendChild(btn);
      });
      btnGrid.appendChild(speedCol);

      const seekCol = document.createElement("div");
      seekCol.style.cssText = "display:flex;flex-direction:column;gap:3px";
      [...cfg.seeks].reverse().forEach((val) => {
        const btn = document.createElement("button");
        btn.textContent = CONFIG.TEXT.SEEK_LABELS[val] || (val >= 0 ? "+" + val + "s" : val + "s");
        btn.style.cssText = "padding:4px 0;border:1px solid #555;border-radius:5px;background:#2a2a2a;color:#fff;cursor:pointer;font-size:" + cfg.ui.btnSize + "px;text-align:center;flex-shrink:0";
        btn.onmouseenter = () => (btn.style.background = "#444");
        btn.onmouseleave = () => (btn.style.background = "#2a2a2a");
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (videoEl) {
            videoEl.currentTime = Math.max(0, videoEl.currentTime + val);
            showSeek(val);
          }
        });
        seekCol.appendChild(btn);
      });
      btnGrid.appendChild(seekCol);
      contentWrap.appendChild(btnGrid);

      playBtn = document.createElement("button");
      playBtn.textContent = videoEl && !videoEl.paused ? "⏸" : "▶";
      playBtn.style.cssText = "padding:8px 0;border:none;border-radius:5px;color:#fff;cursor:pointer;font-weight:500;width:100%;font-size:16px;background:" + (videoEl && !videoEl.paused ? "#dc3545" : "#28a745");
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (videoEl) videoEl.paused ? videoEl.play() : videoEl.pause();
      });
      contentWrap.appendChild(playBtn);

      controls.appendChild(contentWrap);

      document.body.appendChild(controls);

      floatBtn = document.createElement("button");
      floatBtn.id = P + "-hide";
      floatBtn.textContent = CONFIG.TEXT.SHOW_PANEL;
      floatBtn.style.cssText = CONFIG.STYLE.FLOAT_BTN;
      floatBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleVisibility();
      });
      document.body.appendChild(floatBtn);

      try {
        if (GM_getValue(P + "_visible") === false) {
          visible = true;
          toggleVisibility();
        }
      } catch (e) {}

      const startDrag = (cx, cy) => {
        const rect = controls.getBoundingClientRect();
        offsetX = cx - rect.left;
        offsetY = cy - rect.top;
        dragging = true;
        controls.style.cursor = "grabbing";
        controls.style.transition = "none";
      };
      const doDrag = (cx, cy) => {
        if (!dragging) return;
        let nx = cx - offsetX, ny = cy - offsetY;
        const rect = controls.getBoundingClientRect();
        nx = Math.max(5, Math.min(nx, innerWidth - rect.width - 5));
        ny = Math.max(5, Math.min(ny, innerHeight - rect.height - 5));
        controls.style.left = nx + "px";
        controls.style.top = ny + "px";
      };
      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        controls.style.cursor = "move";
        controls.style.transition = "";
        lastPos = { x: controls.style.left, y: controls.style.top };
        GM_setValue(P + "_pos", JSON.stringify(lastPos));
      };
      const onMouseMove = (e) => doDrag(e.clientX, e.clientY);
      const onTouchMove = (e) => {
        if (dragging && e.touches.length === 1) {
          e.preventDefault();
          doDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      };
      dragHandlers = { startDrag, doDrag, endDrag, onMouseMove, onTouchMove };
      controls.addEventListener("mousedown", (e) => {
        if (!isInteractive(e.target)) startDrag(e.clientX, e.clientY);
      });
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", endDrag);
      controls.addEventListener("touchstart", (e) => {
        if (!isInteractive(e.target) && e.touches.length === 1) {
          e.preventDefault();
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: false });
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", endDrag);
      controls.addEventListener("selectstart", (e) => e.preventDefault());
      return;
    }

    controls = document.createElement("div");
    controls.id = P + "-cont";
    // 应用保存的UI配置
    controls.style.cssText = CONFIG.STYLE.PANEL.replace(
      "rgba(0,0,0,.85)",
      `rgba(0,0,0,${cfg.ui.opacity})`,
    ).replace("font-size:14px", `font-size:${cfg.ui.fontSize}px`);

    try {
      const s = GM_getValue(P + "_pos");
      if (s) lastPos = JSON.parse(s);
    } catch (e) {}
    controls.style.left = lastPos.x;
    controls.style.top = lastPos.y;

    const dragHandle = document.createElement("div");
    dragHandle.style.cssText = "width:40px;height:4px;background:#666;border-radius:2px;cursor:grab;margin:0 auto 6px";
    controls.appendChild(dragHandle);

    // 首行：设置 + 亮度 + 音量 + 隐藏按钮
    const headerRow = document.createElement("div");
    headerRow.style.cssText = CONFIG.STYLE.HEADER_ROW;
    const setBtn = document.createElement("button");
    setBtn.innerHTML = "&#9881;";
    setBtn.title = "参数设置 (点击打开)";
    setBtn.style.cssText = CONFIG.STYLE.SETTING_BTN;
    setBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showSettings();
    });
    const layoutBtn = document.createElement("button");
    layoutBtn.textContent = "↕";
    layoutBtn.title = "切换为垂直面板";
    layoutBtn.style.cssText = CONFIG.STYLE.SETTING_BTN;
    layoutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isVertical = true;
      GM_setValue(P + "_layout", "v");
      rebuildPanel();
    });
    const brightBtn = document.createElement("button");
    brightBtn.textContent = CONFIG.TEXT.BRIGHTNESS_BTN;
    brightBtn.title = "调整视频亮度";
    brightBtn.style.cssText = CONFIG.STYLE.SETTING_BTN;
    brightBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = document.getElementById(P + "-brightness");
      if (row)
        row.style.display = row.style.display === "none" ? "flex" : "none";
    });
    const volBtn = document.createElement("button");
    volBtn.textContent = CONFIG.TEXT.VOLUME_BTN;
    volBtn.title = "调整视频音量";
    volBtn.style.cssText = CONFIG.STYLE.SETTING_BTN;
    volBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = document.getElementById(P + "-volume");
      if (row)
        row.style.display = row.style.display === "none" ? "flex" : "none";
    });
    const hidePanelBtn = document.createElement("button");
    hidePanelBtn.textContent = CONFIG.TEXT.HIDE_PANEL;
    hidePanelBtn.style.cssText = CONFIG.STYLE.HIDE_BTN;
    hidePanelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleVisibility();
    });
    headerRow.append(setBtn, layoutBtn, brightBtn, volBtn, hidePanelBtn);
    controls.appendChild(headerRow);

    // 亮度滑块行
    const brightnessRow = document.createElement("div");
    brightnessRow.id = P + "-brightness";
    brightnessRow.style.cssText = CONFIG.STYLE.BRIGHTNESS_ROW + ";display:none";
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
    brightnessReset.style.cssText = CONFIG.STYLE.BRIGHTNESS_RESET;
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
    controls.appendChild(brightnessRow);

    // 初始亮度
    if (videoEl && cfg.ui.brightness !== 1.0)
      videoEl.style.filter = `brightness(${cfg.ui.brightness})`;

    // 音量滑块行
    const volumeRow = document.createElement("div");
    volumeRow.id = P + "-volume";
    volumeRow.style.cssText = CONFIG.STYLE.VOLUME_ROW + ";display:none";
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
    muteBtn.textContent = videoEl && videoEl.muted ? "恢复" : "静音";
    muteBtn.style.cssText = CONFIG.STYLE.VOLUME_RESET;
    muteBtn.title = "切换静音/恢复";
    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!videoEl) return;
      videoEl.muted = !videoEl.muted;
      muteBtn.textContent = videoEl.muted ? "恢复" : "静音";
    });
    volumeRow.append(volumeInput, volumeVal, muteBtn);
    controls.appendChild(volumeRow);

    // 初始音量
    if (videoEl && cfg.ui.volume !== 1.0) videoEl.volume = cfg.ui.volume;

    // 时间行
    const timeRow = document.createElement("div");
    timeRow.style.cssText = CONFIG.STYLE.TIME_ROW;
    curTime = document.createElement("span");
    curTime.style.cssText = CONFIG.STYLE.CURRENT_TIME;
    curTime.textContent = "00:00";
    totalTime = document.createElement("span");
    totalTime.style.cssText = CONFIG.STYLE.TOTAL_TIME;
    totalTime.textContent = "/ 00:00";
    progress = document.createElement("input");
    progress.type = "range";
    progress.min = "0";
    progress.max = "10000";
    progress.value = "0";
    progress.style.cssText = CONFIG.STYLE.PROGRESS;
    progress.addEventListener("input", () => {
      if (videoEl && isFinite(videoEl.duration))
        videoEl.currentTime = (progress.value / 10000) * videoEl.duration;
    });
    timeRow.append(curTime, progress, totalTime);

    // 快进行
    const seekRow = document.createElement("div");
    seekRow.setAttribute("data-seek", "");
    seekRow.style.cssText = CONFIG.STYLE.SEEK_ROW;
    renderSeekRow(seekRow);

    // 动作行（倍速 + 播放）
    actionDiv = document.createElement("div");
    actionDiv.style.cssText = CONFIG.STYLE.ACTION_ROW;
    renderSpeedRow(actionDiv);

    playBtn = document.createElement("button");
    playBtn.textContent =
      videoEl && videoEl.paused ? CONFIG.TEXT.PLAY : CONFIG.TEXT.PAUSE;
    playBtn.style.cssText =
      CONFIG.STYLE.PLAY_BTN +
      `;background:${videoEl && videoEl.paused ? CONFIG.STYLE.PLAY_COLOR : CONFIG.STYLE.PAUSE_COLOR}`;
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (videoEl) videoEl.paused ? videoEl.play() : videoEl.pause();
    });
    actionDiv.appendChild(playBtn);

    controls.append(timeRow, seekRow, actionDiv);
    document.body.appendChild(controls);

    // 浮动显示/隐藏按钮
    floatBtn = document.createElement("button");
    floatBtn.id = P + "-hide";
    floatBtn.textContent = CONFIG.TEXT.SHOW_PANEL;
    floatBtn.style.cssText = CONFIG.STYLE.FLOAT_BTN;
    floatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleVisibility();
    });
    document.body.appendChild(floatBtn);

    // 应用之前保存的可见性状态
    try {
      if (GM_getValue(P + "_visible") === false) {
        visible = true;
        toggleVisibility();
      }
    } catch (e) {}

    // 拖拽事件
    const startDrag = (cx, cy) => {
      const rect = controls.getBoundingClientRect();
      offsetX = cx - rect.left;
      offsetY = cy - rect.top;
      dragging = true;
      controls.style.cursor = "grabbing";
      controls.style.transition = "none";
    };
    const doDrag = (cx, cy) => {
      if (!dragging) return;
      let nx = cx - offsetX,
        ny = cy - offsetY;
      const rect = controls.getBoundingClientRect();
      nx = Math.max(5, Math.min(nx, innerWidth - rect.width - 5));
      ny = Math.max(5, Math.min(ny, innerHeight - rect.height - 5));
      controls.style.left = nx + "px";
      controls.style.top = ny + "px";
    };
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      controls.style.cursor = "move";
      controls.style.transition = "";
      lastPos = { x: controls.style.left, y: controls.style.top };
      GM_setValue(P + "_pos", JSON.stringify(lastPos));
    };

    const onMouseMove = (e) => doDrag(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (dragging && e.touches.length === 1) {
        e.preventDefault();
        doDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    dragHandlers = { startDrag, doDrag, endDrag, onMouseMove, onTouchMove };

    controls.addEventListener("mousedown", (e) => {
      if (!isInteractive(e.target)) startDrag(e.clientX, e.clientY);
    });
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", endDrag);

    controls.addEventListener(
      "touchstart",
      (e) => {
        if (!isInteractive(e.target) && e.touches.length === 1) {
          e.preventDefault();
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false },
    );
    document.addEventListener(
      "touchmove",
      onTouchMove,
      { passive: false },
    );
    document.addEventListener("touchend", endDrag);
    controls.addEventListener("selectstart", (e) => e.preventDefault());
  }

  // ==================== 视频事件绑定 ====================
  function updateSpeedHighlight() {
    if (!actionDiv || !videoEl) return;
    const rate = videoEl.playbackRate;
    actionDiv.querySelectorAll("button[data-speed]").forEach((btn) => {
      const sp = parseFloat(btn.dataset.speed);
      if (Math.abs(rate - sp) < 0.01) {
        btn.style.background = CONFIG.STYLE.SPEED_BTN_ACTIVE;
        curSpeedBtn = btn;
      } else btn.style.background = "#2a2a2a";
    });
  }

  function setupListeners() {
    if (!videoEl) return;
    videoEl.addEventListener("loadedmetadata", () => {
      L("metadata loaded");
      if (totalTime && isFinite(videoEl.duration))
        totalTime.textContent = "/ " + formatTime(videoEl.duration);
      updateProgress();
      updateSpeedHighlight();
    });
    videoEl.addEventListener("timeupdate", updateProgress);
    videoEl.addEventListener("play", () => {
      playBtn.textContent = isVertical ? "⏸" : CONFIG.TEXT.PAUSE;
      playBtn.style.background = CONFIG.STYLE.PAUSE_COLOR;
    });
    videoEl.addEventListener("pause", () => {
      playBtn.textContent = isVertical ? "▶" : CONFIG.TEXT.PLAY;
      playBtn.style.background = CONFIG.STYLE.PLAY_COLOR;
    });
    videoEl.addEventListener("ratechange", updateSpeedHighlight);
    videoEl.addEventListener("volumechange", () => {
      const muteBtn = document.getElementById(P + "-volume");
      if (muteBtn)
        muteBtn.lastChild.textContent = videoEl.muted ? "恢复" : "静音";
    });
  }

  // ==================== 清理与初始化 ====================
  function cleanup() {
    L("Cleaning");
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (settingsOverlay && settingsOverlay.parentNode)
      settingsOverlay.parentNode.removeChild(settingsOverlay);
    if (controls && controls.parentNode)
      controls.parentNode.removeChild(controls);
    if (floatBtn && floatBtn.parentNode)
      floatBtn.parentNode.removeChild(floatBtn);
    if (dragHandlers) {
      document.removeEventListener("mousemove", dragHandlers.onMouseMove);
      document.removeEventListener("mouseup", dragHandlers.endDrag);
      document.removeEventListener("touchmove", dragHandlers.onTouchMove);
      document.removeEventListener("touchend", dragHandlers.endDrag);
      dragHandlers = null;
    }
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
    actionDiv = null;
    curSpeedBtn = null;
    settingsOverlay = null;
    exists = false;
  }

  function init() {
    if (document.getElementById(P + "-cont")) {
      exists = true;
      return;
    }
    exists = false;
    videoEl = findVideo();
    if (!videoEl) {
      L("No video");
      return;
    }
    L(`Video: ${(videoEl.src || "").slice(0, 50) || "<inline>"}`);
    createControls();
    setupListeners();
  }

  function start() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        setTimeout(init, CONFIG.INIT_DELAY),
      );
    } else {
      setTimeout(init, CONFIG.INIT_DELAY);
    }
    observer = new MutationObserver(() => {
      if (!videoEl || !document.body.contains(videoEl)) {
        const newVid = findVideo();
        if (newVid && newVid !== videoEl) {
          L("New video detected");
          cleanup();
          setTimeout(init, 300);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("beforeunload", cleanup);
  }

  start();
})();
