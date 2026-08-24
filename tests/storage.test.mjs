import assert from "node:assert/strict";
import test from "node:test";

await import("../src/shared/defaults.js");
await import("../src/shared/storage.js");
await import("../src/shared/messages.js");

const FCC = globalThis.FCC;

function createStorage(initial = {}) {
  const data = structuredClone(initial);
  return {
    data,
    async get(keys) {
      if (typeof keys === "string") return { [keys]: data[keys] };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, data[key]]));
      return structuredClone(data);
    },
    async set(changes) {
      Object.assign(data, structuredClone(changes));
    },
  };
}

test("stored settings merge with new defaults", async () => {
  const storage = createStorage({ settings: { removeSponsored: false } });
  const settings = await FCC.getSettings(storage);
  assert.equal(settings.removeSponsored, false);
  assert.equal(settings.removeReels, true);
  assert.equal(settings.cleanMode, false);
});

test("damaged storage values fall back safely", async () => {
  const storage = createStorage({ settings: "broken", stats: { total: -1, reels: "many" } });
  assert.deepEqual(await FCC.getSettings(storage), { ...FCC.defaultSettings });
  assert.deepEqual(await FCC.getStats(storage), { ...FCC.defaultStats });
});

test("stat increments update categories and total", async () => {
  const storage = createStorage();
  const stats = await FCC.incrementStats({ reels: 2, sponsored: 1 }, storage);
  assert.deepEqual(stats, { reels: 2, sponsored: 1, suggested: 0, other: 0, total: 3 });
});

test("invalid settings messages are rejected", async () => {
  const result = await FCC.handleMessage(
    { type: FCC.messageTypes.SETTINGS_UPDATE, changes: { removeSponsored: "yes" } },
    {},
  );
  assert.equal(result.ok, false);
});

test("unknown messages do not execute a service", () => {
  let called = false;
  const result = FCC.handleMessage({ type: "unknown:operation" }, new Proxy({}, {
    get() {
      called = true;
    },
  }));
  assert.equal(result, undefined);
  assert.equal(called, false);
});
