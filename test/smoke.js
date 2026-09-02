"use strict";
/* Smoke test: loads analyzer+background+content with stubs and runs the local engine */
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..") + path.sep;

class Ctx2d {
  constructor(w, h) { this.w = w; this.h = h; }
  drawImage() {}
  getImageData() {
    const data = new Uint8ClampedArray(this.w * this.h * 4);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      if (x < this.w / 2) { data[i] = 210; data[i + 1] = 120; data[i + 2] = 40; }
      else { data[i] = 25; data[i + 1] = 25; data[i + 2] = 30; }
      data[i + 3] = 255;
    }
    return { data };
  }
}
class OffscreenCanvas {
  constructor(w, h) { this.width = w; this.height = h; }
  getContext() { return new Ctx2d(this.width, this.height); }
}

function el() {
  return {
    style: {}, children: [], textContent: "", type: "", className: "", title: "", alt: "",
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ""; },
    appendChild(c) { this.children.push(c); return c; },
    remove() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return el(); }, contains() { return false; }, select() {},
    getBoundingClientRect() { return { top: 10, left: 10, right: 310, width: 300, height: 200 }; },
  };
}
const documentStub = {
  createElement: () => el(), addEventListener() {}, body: el(), documentElement: el(),
  images: [], execCommand() {},
};
const windowStub = { addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 800 };

const created = {};
const msgListeners = [];
const listeners = {};
const browserStub = {
  contextMenus: { create: (o) => { created.menu = o; }, onClicked: { addListener: (f) => { listeners.menu = f; } } },
  runtime: {
    onMessage: { addListener: (f) => { msgListeners.push(f); } },
    sendMessage: async () => ({ ok: true, prompt: "stub" }),
  },
  storage: { sync: { get: async (d) => Object.assign({}, d) } },
  tabs: {}, scripting: {},
};

const sandbox = {
  browser: browserStub, OffscreenCanvas,
  createImageBitmap: async () => ({ width: 800, height: 600 }),
  Image: class {}, console,
  document: documentStub, window: windowStub,
  navigator: { clipboard: { writeText: async () => {} } },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dir + "analyzer.js", "utf8"), sandbox, { filename: "analyzer.js" });
vm.runInContext(fs.readFileSync(dir + "background.js", "utf8"), sandbox, { filename: "background.js" });
vm.runInContext(fs.readFileSync(dir + "content.js", "utf8"), sandbox, { filename: "content.js" });
console.log("LOAD-OK; menu created:", JSON.stringify(created.menu && created.menu.title));

(async () => {
  const res = await sandbox.analyzeLocally({}, "data:image/png;base64,x");
  console.log("ENGINE-OK engine=" + res.engine);
  console.log("---- PROMPT ----");
  console.log(res.prompt);
  const bgListener = msgListeners[0]; // background.js registers first
  const r2 = await Promise.resolve(bgListener({ type: "ANALYZE", src: "http://example.test/y.png" }));
  console.log("BG-ANALYZE(no network expected):", JSON.stringify(r2).slice(0, 160));
  const pong = msgListeners[1]({ type: "PING" });
  console.log("CONTENT-PING:", pong);
  console.log("SMOKE-DONE");
})().catch((e) => { console.error("SMOKE-FAIL", e); process.exit(1); });
