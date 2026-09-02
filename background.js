/* PromptCard — background script: menu, mesajlar, AI çağrısı */
"use strict";

const STORAGE_DEFAULTS = {
  apiBase: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

const AI_INSTRUCTIONS =
  "You are PromptCard. Look at the attached image and write ONE detailed, ready-to-use " +
  "image-generation prompt (for Midjourney / Stable Diffusion / DALL-E) that would recreate " +
  "a similar image. Describe subject, composition, camera angle, lighting, color palette, " +
  "mood, style, level of detail and aspect ratio. Output ONLY the prompt text: no intro, " +
  "no quotes, no markdown.";

/* ---------------- sağ tık menüsü ---------------- */
browser.contextMenus.create({
  id: "promptcard-analyze",
  title: "🎴 PromptCard: Bu görsel için AI prompt üret",
  contexts: ["image"],
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "promptcard-analyze" || !tab || !tab.id || !info.srcUrl) return;
  await ensureContentScript(tab.id);
  try {
    await browser.tabs.sendMessage(tab.id, { type: "OPEN_OVERLAY", src: info.srcUrl });
  } catch (err) {
    console.warn("[PromptCard] Sayfaya ulaşılamadı:", err && err.message);
  }
});

async function ensureContentScript(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch (e) { /* henüz enjekte değil */ }
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await browser.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    return true;
  } catch (err) {
    console.warn("[PromptCard] Content script enjekte edilemedi:", err && err.message);
    return false;
  }
}

/* ---------------- mesajlar ---------------- */
browser.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== "object") return undefined;
  if (msg.type === "ANALYZE") return analyzeImage(msg.src);
  return undefined;
});

async function analyzeImage(src) {
  let blob;
  try {
    const resp = await fetch(src, { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    blob = await resp.blob();
  } catch (err) {
    return { ok: false, error: "Görsel indirilemedi: " + (err && err.message) };
  }
  const dataUrl = await blobToDataURL(blob);
  const settings = Object.assign({}, STORAGE_DEFAULTS, await browser.storage.sync.get(STORAGE_DEFAULTS));

  if (settings.apiKey) {
    try {
      const prompt = await analyzeWithAI(settings, dataUrl);
      return { ok: true, engine: "ai", prompt };
    } catch (err) {
      const local = await analyzeLocally(blob, dataUrl);
      local.note = "AI isteği başarısız oldu (" + (err && err.message) + ") — yerel analiz kullanıldı.";
      return local;
    }
  }
  const local = await analyzeLocally(blob, dataUrl);
  local.note = "API anahtarı yok — yerleşik yerel analiz kullanıldı. Daha zengin promptlar için eklenti ayarlarından OpenAI uyumlu bir anahtar ekleyebilirsin.";
  return local;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function analyzeWithAI(settings, dataUrl) {
  const resp = await fetch(settings.apiBase.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + settings.apiKey,
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: AI_INSTRUCTIONS },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    let detail = "";
    try { detail = await resp.text(); } catch (e) {}
    throw new Error("API " + resp.status + (detail ? ": " + detail.slice(0, 140) : ""));
  }
  const json = await resp.json();
  const text = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!text) throw new Error("Modelden boş yanıt geldi");
  return text.trim();
}
