/* PromptCard — local (offline) analysis engine */
"use strict";

const COLOR_NAMES = [
  ["black", 0, 0, 0], ["charcoal", 54, 54, 54], ["gray", 128, 128, 128], ["silver", 192, 192, 192],
  ["white", 255, 255, 255], ["crimson", 220, 20, 60], ["red", 255, 0, 0], ["maroon", 128, 0, 0],
  ["coral", 255, 127, 80], ["orange", 255, 165, 0], ["amber", 255, 191, 0], ["gold", 255, 215, 0],
  ["yellow", 255, 255, 0], ["olive", 128, 128, 0], ["cream", 255, 248, 220], ["beige", 245, 245, 220],
  ["tan", 210, 180, 140], ["brown", 139, 69, 19], ["chocolate", 123, 63, 0], ["peach", 255, 218, 185],
  ["lime", 50, 205, 50], ["green", 0, 128, 0], ["forest green", 34, 139, 34], ["mint", 152, 255, 152],
  ["teal", 0, 128, 128], ["turquoise", 64, 224, 208], ["cyan", 0, 255, 255], ["sky blue", 135, 206, 235],
  ["azure", 0, 127, 255], ["blue", 0, 0, 255], ["navy", 0, 0, 128], ["indigo", 75, 0, 130],
  ["violet", 238, 130, 238], ["purple", 128, 0, 128], ["magenta", 255, 0, 255], ["pink", 255, 192, 203],
  ["rose", 255, 0, 127], ["lavender", 230, 230, 250], ["slate", 112, 128, 144], ["khaki", 195, 176, 145],
];

function nearestColorName(r, g, b) {
  let best = COLOR_NAMES[0][0];
  let bestD = Infinity;
  for (const c of COLOR_NAMES) {
    const d = (r - c[1]) * (r - c[1]) + (g - c[2]) * (g - c[2]) + (b - c[3]) * (b - c[3]);
    if (d < bestD) { bestD = d; best = c[0]; }
  }
  return best;
}

function pcHex(x) { return x.toString(16).padStart(2, "0"); }

function aspectLabel(W, H) {
  const a = W / H;
  const known = [["1:1", 1], ["5:4", 1.25], ["4:3", 4 / 3], ["3:2", 1.5], ["16:9", 16 / 9], ["2:1", 2], ["21:9", 21 / 9], ["3:4", 0.75], ["2:3", 2 / 3], ["9:16", 9 / 16]];
  let best = known[0];
  for (const k of known) if (Math.abs(a - k[1]) < Math.abs(a - best[1])) best = k;
  return best[0];
}

function decodeViaImg(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be decoded"));
    img.src = dataUrl;
  });
}

async function analyzeLocally(blob, dataUrl) {
  let bmp;
  try { bmp = await createImageBitmap(blob); }
  catch (e) { bmp = await decodeViaImg(dataUrl); }

  const W = bmp.width || 1;
  const H = bmp.height || 1;
  const scale = 96 / Math.max(W, H);
  const w = Math.max(8, Math.round(W * scale));
  const h = Math.max(8, Math.round(H * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;

  let lumSum = 0, satSum = 0, tempSum = 0;
  const lums = new Float32Array(n);
  const bins = new Map();
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lums[p] = lum;
    lumSum += lum;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    satSum += mx === 0 ? 0 : (mx - mn) / mx;
    tempSum += r - b;
    const key = (r >> 5) + "-" + (g >> 5) + "-" + (b >> 5);
    const cur = bins.get(key);
    if (cur) { cur.n++; cur.r += r; cur.g += g; cur.b += b; }
    else bins.set(key, { n: 1, r, g, b });
  }
  const lumAvg = lumSum / n;
  const satAvg = satSum / n;
  const tempAvg = tempSum / n;

  let varSum = 0;
  for (let p = 0; p < n; p++) varSum += (lums[p] - lumAvg) * (lums[p] - lumAvg);
  const lumStd = Math.sqrt(varSum / n);

  let edgeSum = 0, edgeN = 0;
  for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { edgeSum += Math.abs(lums[y * w + x] - lums[y * w + x - 1]); edgeN++; }
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) { edgeSum += Math.abs(lums[y * w + x] - lums[(y - 1) * w + x]); edgeN++; }
  const edgeAvg = edgeSum / edgeN;

  let borderSum = 0, borderN = 0, centerSum = 0, centerN = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < w * 0.12 || x > w * 0.88 || y < h * 0.12 || y > h * 0.88) { borderSum += lums[y * w + x]; borderN++; }
    else { centerSum += lums[y * w + x]; centerN++; }
  }
  const vignette = borderSum / borderN - centerSum / centerN;

  const top = [...bins.values()].sort((a, b) => b.n - a.n).slice(0, 4).map((c2) => ({
    r: Math.round(c2.r / c2.n), g: Math.round(c2.g / c2.n), b: Math.round(c2.b / c2.n),
    pct: Math.round((100 * c2.n) / n),
  }));

  const lighting = lumAvg < 75 ? "dark, low-key lighting" : lumAvg > 170 ? "bright, high-key lighting" : "balanced, natural lighting";
  const contrast = lumStd < 38 ? "low, soft contrast" : lumStd > 78 ? "high, dramatic contrast" : "medium contrast";
  const palette = satAvg < 0.08 ? "monochrome, near black-and-white palette" : satAvg < 0.25 ? "muted, desaturated palette" : satAvg > 0.55 ? "vivid, highly saturated palette" : "natural color saturation";
  const temp = tempAvg > 14 ? "warm, golden color temperature" : tempAvg < -14 ? "cool, bluish color temperature" : "neutral color temperature";
  const detail = edgeAvg > 26 ? "crisp edges and fine detail" : edgeAvg < 10 ? "soft focus, smooth gradients (shallow depth of field / painterly look)" : "moderate detail and texture";
  const vign = vignette < -18 ? "dark vignette framing the edges" : vignette > 18 ? "bright edges framing a darker center" : "";
  const orientation = W > H * 1.15 ? "landscape (horizontal) composition" : H > W * 1.15 ? "portrait (vertical) composition" : "square composition";

  let mood;
  if (lumAvg < 85 && tempAvg > 10) mood = "moody, cinematic atmosphere";
  else if (lumAvg < 85 && satAvg < 0.2) mood = "somber, minimalist atmosphere";
  else if (lumAvg > 160 && satAvg > 0.4) mood = "vibrant, energetic atmosphere";
  else if (lumAvg > 160) mood = "airy, light atmosphere";
  else if (tempAvg < -10) mood = "calm, cold atmosphere";
  else mood = "balanced, natural atmosphere";

  let style;
  if (satAvg < 0.08 && edgeAvg > 20) style = "black-and-white photography";
  else if (edgeAvg < 9 && satAvg > 0.3) style = "digital painting / illustration look";
  else if (edgeAvg > 24) style = "sharp professional photography";
  else style = "photographic or cinematic still";

  const ar = aspectLabel(W, H);
  const colorLine = top.map((c2) => nearestColorName(c2.r, c2.g, c2.b) + " (#" + pcHex(c2.r) + pcHex(c2.g) + pcHex(c2.b) + ", " + c2.pct + "%)").join(", ");
  const oneLiner = style + ", " + orientation + ", " + lighting + ", " + contrast + ", " + temp + ", " + palette +
    ", dominant " + top.map((c2) => nearestColorName(c2.r, c2.g, c2.b)).join(" and ") + " tones, " + detail +
    (vign ? ", " + vign : "") + ", " + mood + ", aspect ratio " + ar;

  const prompt = [
    "Detailed image-recreation prompt",
    "================================",
    "Style: " + style + ".",
    "Composition: " + orientation + ", " + W + "x" + H + " px, aspect ratio " + ar + ".",
    "Lighting: " + lighting + "; " + contrast + ".",
    "Color: " + palette + "; " + temp + ".",
    "Dominant colors: " + colorLine + ".",
    "Detail: " + detail + (vign ? "; " + vign : "") + ".",
    "Mood: " + mood + ".",
    "",
    "Copy-ready one-liner:",
    oneLiner,
  ].join("\n");

  return { ok: true, engine: "local", prompt };
}
