(function (root) {
  "use strict";

  const FCC = root.FCC;

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function mergeSettings(stored) {
    const settings = { ...FCC.defaultSettings };
    if (!isRecord(stored)) return settings;

    for (const key of FCC.settingKeys) {
      if (typeof stored[key] === "boolean") settings[key] = stored[key];
    }

    return settings;
  }

  function mergeStats(stored) {
    const stats = { ...FCC.defaultStats };
    if (!isRecord(stored)) return stats;

    for (const key of Object.keys(FCC.defaultStats)) {
      if (Number.isSafeInteger(stored[key]) && stored[key] >= 0) {
        stats[key] = stored[key];
      }
    }

    return stats;
  }

  function getArea(area) {
    return area || chrome.storage.local;
  }

  async function getSettings(area) {
    const result = await getArea(area).get("settings");
    return mergeSettings(result && result.settings);
  }

  async function updateSettings(changes, area) {
    const settings = await getSettings(area);
    for (const key of FCC.settingKeys) {
      if (typeof changes[key] === "boolean") settings[key] = changes[key];
    }
    await getArea(area).set({ settings });
    return settings;
  }

  async function resetSettings(area) {
    const settings = { ...FCC.defaultSettings };
    await getArea(area).set({ settings });
    return settings;
  }

  async function getStats(area) {
    const result = await getArea(area).get("stats");
    return mergeStats(result && result.stats);
  }

  async function incrementStats(counts, area) {
    const stats = await getStats(area);
    let totalIncrement = 0;

    for (const key of FCC.statKeys) {
      const increment = counts[key] || 0;
      if (!Number.isSafeInteger(increment) || increment < 0) continue;
      const next = stats[key] + increment;
      stats[key] = Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
      totalIncrement += increment;
    }

    const total = stats.total + totalIncrement;
    stats.total = Number.isSafeInteger(total) ? total : Number.MAX_SAFE_INTEGER;
    await getArea(area).set({ stats });
    return stats;
  }

  async function resetStats(area) {
    const stats = { ...FCC.defaultStats };
    await getArea(area).set({ stats });
    return stats;
  }

  async function ensureStorage(area) {
    const storageArea = getArea(area);
    const stored = await storageArea.get(["settings", "stats", "storageVersion"]);
    const data = {
      settings: mergeSettings(stored.settings),
      stats: mergeStats(stored.stats),
      storageVersion: FCC.STORAGE_VERSION,
    };
    await storageArea.set(data);
    return data;
  }

  Object.assign(FCC, {
    ensureStorage,
    getSettings,
    getStats,
    incrementStats,
    isRecord,
    mergeSettings,
    mergeStats,
    resetSettings,
    resetStats,
    updateSettings,
  });
})(globalThis);
