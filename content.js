/* PromptCard content script: hover chip + prompt overlay */
(function () {
  "use strict";
  if (window.__promptcardLoaded) return;
  window.__promptcardLoaded = true;

  /* ---------- görsel üzerine gelince beliren chip ---------- */
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "pc-chip";
  chip.textContent = "🎴 Prompt";
  chip.style.display = "none";
  let chipTarget = null;
  let lang = PC_DEFAULT_LANG;
  function T(k, v) { return pcT(lang, k, v); }
  pcGetLang().then((l) => { lang = l; });
  try {
    browser.storage.onChanged.addListener((c, a) => {
      if (a === "sync" && c && c.lang) lang = c.lang.newValue || PC_DEFAULT_LANG;
    });
  } catch (e) {}
  (document.body || document.documentElement).appendChild(chip);

  document.addEventListener("mouseover", (e) => {
    const t = e.target;
    const img = t && t.closest ? t.closest("img") : null;
    if (!img || img.closest(".pc-overlay")) return;
    const r = img.getBoundingClientRect();
    if (r.width < 140 || r.height < 140) return;
    chipTarget = img;
    chip.style.display = "flex";
    chip.style.top = (r.top + 8) + "px";
    chip.style.left = Math.max(8, r.right - 110) + "px";
  }, true);

  document.addEventListener("mouseout", (e) => {
    const t = e.target;
    const img = t && t.closest ? t.closest("img") : null;
    if (img !== chipTarget) return;
    const to = e.relatedTarget;
    if (to === chip || (to && chip.contains(to))) return;
    chip.style.display = "none";
    chipTarget = null;
  }, true);

  chip.addEventListener("mouseenter", () => { chip.style.display = "flex"; });
  chip.addEventListener("mouseleave", () => { chip.style.display = "none"; chipTarget = null; });
  chip.addEventListener("click", () => {
    if (chipTarget) startFlow(chipTarget);
    chip.style.display = "none";
    chipTarget = null;
  });

  function startFlow(img) {
    const ov = createOverlay(img);
    requestAnalysis(img, ov);
  }

  function requestAnalysis(img, ov) {
    ov.showLoading();
    browser.runtime.sendMessage({ type: "ANALYZE", src: img.currentSrc || img.src })
      .then((res) => {
        if (res && res.ok) ov.showPrompt(res.prompt, res.note);
        else if (res && res.error) ov.showError(res.error);
        else ov.showError(T("analyzeFail"));
      })
      .catch((err) => ov.showError(err && err.message ? err.message : String(err)));
  }

  /* ---------- overlay panel ---------- */
  function createOverlay(img) {
    const ov = document.createElement("div");
    ov.className = "pc-overlay";
    const panel = document.createElement("div");
    panel.className = "pc-panel";
    panel.innerHTML =
      '<div class="pc-head"><span class="pc-title">PROMPT</span><button class="pc-x" title="' + T("close") + '">✕</button></div>' +
      '<div class="pc-body"></div>' +
      '<div class="pc-foot"><button class="pc-btn pc-copy">' + T("copy") + '</button>' +
      '<button class="pc-btn pc-redo">' + T("redo") + '</button><span class="pc-brand">PROMPTCARD</span></div>';
    ov.appendChild(panel);
    document.body.appendChild(ov);

    function place() {
      let left, top;
      if (img) {
        const r = img.getBoundingClientRect();
        const width = Math.min(Math.max(r.width, 280), 640);
        panel.style.width = width + "px";
        left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
        top = Math.max(8, Math.min(r.top, window.innerHeight - 340));
      } else {
        panel.style.width = "480px";
        left = Math.max(8, (window.innerWidth - 480) / 2);
        top = Math.max(8, (window.innerHeight - 400) / 2);
      }
      ov.style.left = left + "px";
      ov.style.top = top + "px";
    }
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);

    const body = panel.querySelector(".pc-body");
    const copyBtn = panel.querySelector(".pc-copy");
    let promptText = "";

    const api = {
      showLoading() { body.innerHTML = '<div class="pc-loading">' + T("loading") + '</div>'; },
      showPrompt(text, note) {
        promptText = text;
        body.innerHTML = "";
        const pre = document.createElement("pre");
        pre.className = "pc-text";
        pre.textContent = text;
        body.appendChild(pre);
        if (note) {
          const nd = document.createElement("div");
          nd.className = "pc-note";
          nd.textContent = note;
          body.appendChild(nd);
        }
      },
      showError(msg) {
        body.innerHTML = "";
        const d = document.createElement("div");
        d.className = "pc-error";
        d.textContent = "⚠ " + msg;
        body.appendChild(d);
      },
    };

    function cleanup() {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      ov.remove();
    }
    panel.querySelector(".pc-x").addEventListener("click", cleanup);

    copyBtn.addEventListener("click", async () => {
      if (!promptText) return;
      try { await navigator.clipboard.writeText(promptText); }
      catch (e) {
        const ta = document.createElement("textarea");
        ta.value = promptText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      const old = copyBtn.textContent;
      copyBtn.textContent = T("copied");
      setTimeout(() => { copyBtn.textContent = old; }, 1500);
    });

    panel.querySelector(".pc-redo").addEventListener("click", () => {
      if (img) requestAnalysis(img, api);
    });

    api.showLoading();
    return api;
  }

  function findImageBySrc(src) {
    if (!src) return null;
    for (const im of document.images) {
      if (im.src === src || im.currentSrc === src) return im;
    }
    return null;
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== "object") return undefined;
    if (msg.type === "PING") return "pong";
    if (msg.type === "OPEN_OVERLAY" || msg.type === "ANALYZE_TARGET") {
      const img = findImageBySrc(msg.src);
      if (img) startFlow(img);
      else requestAnalysis({ currentSrc: msg.src, src: msg.src }, createOverlay(null));
      return "ok";
    }
    if (msg.type === "LIST_IMAGES") {
      const list = [];
      for (const im of document.images) {
        if (im.naturalWidth > 60 && im.naturalHeight > 60) {
          const r = im.getBoundingClientRect();
          list.push({ src: im.currentSrc || im.src, w: Math.round(r.width), h: Math.round(r.height), alt: im.alt || "" });
        }
      }
      list.sort((a, b) => b.w * b.h - a.w * a.h);
      return list.slice(0, 30);
    }
    return undefined;
  });
})();
