import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const projectRoot = new URL("../", import.meta.url);

async function createBackground(initial) {
  const data = structuredClone(initial);
  let messageListener;
  const storage = {
    async get(keys) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      if (typeof keys === "string") return { [keys]: structuredClone(data[keys]) };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, structuredClone(data[key])]));
      return structuredClone(data);
    },
    async set(changes) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      Object.assign(data, structuredClone(changes));
    },
  };
  const context = vm.createContext({
    chrome: {
      runtime: {
        onInstalled: { addListener() {} },
        onMessage: { addListener(listener) { messageListener = listener; } },
      },
      storage: { local: storage },
    },
    console,
    importScripts() {},
    setTimeout,
  });

  for (const file of [
    "src/shared/defaults.js",
    "src/shared/storage.js",
    "src/shared/messages.js",
    "src/background.js",
  ]) {
    vm.runInContext(await readFile(new URL(file, projectRoot), "utf8"), context, { filename: file });
  }

  function send(message) {
    return new Promise((resolve) => {
      assert.equal(messageListener(message, {}, resolve), true);
    });
  }

  return { data, send };
}

test("concurrent setting updates do not overwrite each other", async () => {
  const background = await createBackground({
    settings: { removeReels: true, removeSponsored: true },
  });
  await Promise.all([
    background.send({ type: "settings:update", changes: { removeReels: false } }),
    background.send({ type: "settings:update", changes: { removeSponsored: false } }),
  ]);
  assert.equal(background.data.settings.removeReels, false);
  assert.equal(background.data.settings.removeSponsored, false);
});

test("a queued reset wins over an earlier statistic increment", async () => {
  const background = await createBackground({
    stats: { reels: 5, sponsored: 0, suggested: 0, other: 0, total: 5 },
  });
  await Promise.all([
    background.send({ type: "stats:increment", counts: { reels: 1 } }),
    background.send({ type: "stats:reset" }),
  ]);
  assert.equal(background.data.stats.reels, 0);
  assert.equal(background.data.stats.total, 0);
});
