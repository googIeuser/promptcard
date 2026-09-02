/* PromptCard popup */
"use strict";

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");

document.getElementById("settings").addEventListener("click", () => browser.runtime.openOptionsPage());

async function init() {
  statusEl.textContent = "Sayfa taranıyor…";
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
    statusEl.textContent = "Bu sayfa desteklenmiyor (yalnızca http/https sayfaları).";
    return;
  }
  try {
    await browser.tabs.sendMessage(tab.id, { type: "PING" });
  } catch (e) {
    try {
      await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await browser.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    } catch (e2) {
      statusEl.textContent = "Sayfaya content script enjekte edilemedi.";
      return;
    }
  }
  let list = [];
  try { list = await browser.tabs.sendMessage(tab.id, { type: "LIST_IMAGES" }); } catch (e) {}
  if (!Array.isArray(list) || list.length === 0) {
    statusEl.textContent = "Sayfada analiz edilebilir görsel bulunamadı.";
    return;
  }
  statusEl.textContent = list.length + " görsel bulundu — prompt üretmek için birine tıkla.";
  grid.innerHTML = "";
  for (const item of list.slice(0, 12)) {
    const cell = document.createElement("button");
    cell.className = "cell";
    const im = document.createElement("img");
    im.src = item.src;
    im.alt = item.alt;
    cell.appendChild(im);
    const cap = document.createElement("span");
    cap.textContent = item.w + "×" + item.h;
    cell.appendChild(cap);
    cell.addEventListener("click", async () => {
      try { await browser.tabs.sendMessage(tab.id, { type: "ANALYZE_TARGET", src: item.src }); } catch (e) {}
      window.close();
    });
    grid.appendChild(cell);
  }
}

document.addEventListener("DOMContentLoaded", init);
