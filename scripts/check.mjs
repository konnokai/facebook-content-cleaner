import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ["storage", "activeTab"]);
assert.equal("externally_connectable" in manifest, false);
assert.equal(JSON.stringify(manifest).includes("<all_urls>"), false);

for (const locale of ["en", "zh_TW"]) {
  JSON.parse(await readFile(path.join(root, "_locales", locale, "messages.json"), "utf8"));
}

const sourceFiles = await filesUnder(path.join(root, "src"));
for (const file of sourceFiles.filter((name) => name.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

for (const file of sourceFiles.filter((name) => name.endsWith(".html"))) {
  const html = await readFile(file, "utf8");
  assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, `${file} contains inline script`);
}

const background = await readFile(path.join(root, "src", "background.js"), "utf8");
assert.equal(/^\s*await\b/m.test(background), false, "background has top-level await");

console.log("Manifest, locales, scripts, and extension CSP checks passed.");
