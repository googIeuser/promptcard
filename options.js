/* PromptCard options */
"use strict";

const DEFAULTS = { apiBase: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" };

browser.storage.sync.get(DEFAULTS).then((s) => {
  document.getElementById("apiBase").value = s.apiBase || "";
  document.getElementById("apiKey").value = s.apiKey || "";
  document.getElementById("model").value = s.model || "";
});

document.getElementById("save").addEventListener("click", () => {
  browser.storage.sync.set({
    apiBase: document.getElementById("apiBase").value.trim(),
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value.trim() || DEFAULTS.model,
  }).then(() => {
    const m = document.getElementById("msg");
    m.textContent = "Kaydedildi ✓";
    setTimeout(() => { m.textContent = ""; }, 2000);
  });
});
