/* PromptCard options (i18n-aware) */
"use strict";

const DEFAULTS = { apiBase: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini", lang: PC_DEFAULT_LANG };

let lang = PC_DEFAULT_LANG;

function applyLang() {
  document.documentElement.lang = lang;
  document.title = pcT(lang, "optTitle");
  document.getElementById("l-lang").textContent = pcT(lang, "langLabel");
  document.getElementById("l-apiBase").textContent = pcT(lang, "apiBaseLabel");
  document.getElementById("l-apiKey").textContent = pcT(lang, "apiKeyLabel");
  document.getElementById("l-model").textContent = pcT(lang, "modelLabel");
  document.getElementById("hint").textContent = pcT(lang, "optHint");
  document.getElementById("save").textContent = pcT(lang, "save");
}

browser.storage.sync.get(DEFAULTS).then((s) => {
  lang = s.lang || DEFAULTS.lang;
  document.getElementById("lang").value = lang;
  document.getElementById("apiBase").value = s.apiBase || "";
  document.getElementById("apiKey").value = s.apiKey || "";
  document.getElementById("model").value = s.model || "";
  applyLang();
});

document.getElementById("lang").addEventListener("change", () => {
  lang = document.getElementById("lang").value === "tr" ? "tr" : "en";
  applyLang();
});

document.getElementById("save").addEventListener("click", () => {
  browser.storage.sync.set({
    lang,
    apiBase: document.getElementById("apiBase").value.trim(),
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value.trim() || DEFAULTS.model,
  }).then(() => {
    const m = document.getElementById("msg");
    m.textContent = pcT(lang, "saved");
    setTimeout(() => { m.textContent = ""; }, 2000);
  });
});
