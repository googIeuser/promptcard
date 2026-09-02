"use strict";
/* Validates i18n: en/tr parity and that every key used in code exists in both dicts */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const dir = path.join(__dirname, "..") + path.sep;

const sandbox = { globalThis: {}, browser: { storage: { sync: { get: async (d) => Object.assign({}, d) } } } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dir + "messages.js", "utf8"), sandbox, { filename: "messages.js" });

const en = Object.keys(sandbox.PC_MESSAGES.en).sort();
const tr = Object.keys(sandbox.PC_MESSAGES.tr).sort();
const missingTr = en.filter((k) => !sandbox.PC_MESSAGES.tr[k]);
const missingEn = tr.filter((k) => !sandbox.PC_MESSAGES.en[k]);
if (missingTr.length || missingEn.length) {
  console.error("PARITY-FAIL missingTr=" + JSON.stringify(missingTr) + " missingEn=" + JSON.stringify(missingEn));
  process.exit(1);
}
console.log("PARITY-OK keys=" + en.length);

const used = new Set();
for (const f of ["background.js", "content.js", "popup.js", "options.js"]) {
  const s = fs.readFileSync(dir + f, "utf8");
  const re = /(?:\bT|\bpcT)\(\s*(?:[^()]*\([^)]*\)|[^,)]+)?,?\s*["']([a-zA-Z][a-zA-Z0-9]*)["']/g;
  let m;
  while ((m = re.exec(s))) used.add(m[1]);
}
const bad = [...used].filter((k) => !(k in sandbox.PC_MESSAGES.en) || !(k in sandbox.PC_MESSAGES.tr));
console.log("USED-KEYS=" + used.size + (bad.length ? " MISSING=" + JSON.stringify(bad) : " ALL-PRESENT"));
if (bad.length) process.exit(1);
console.log("I18N-VALIDATION-DONE");
