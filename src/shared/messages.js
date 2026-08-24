(function (root) {
  "use strict";

  const FCC = root.FCC;

  const messageTypes = Object.freeze({
    SETTINGS_GET: "settings:get",
    SETTINGS_UPDATE: "settings:update",
    SETTINGS_RESET: "settings:reset",
    STATS_GET: "stats:get",
    STATS_INCREMENT: "stats:increment",
    STATS_RESET: "stats:reset",
    CONTENT_RESCAN: "content:rescan",
  });

  function validSettingsChanges(changes) {
    if (!FCC.isRecord(changes)) return false;
    const keys = Object.keys(changes);
    return (
      keys.length > 0 &&
      keys.every(
        (key) => FCC.settingKeys.includes(key) && typeof changes[key] === "boolean",
      )
    );
  }

  function validStatCounts(counts) {
    if (!FCC.isRecord(counts)) return false;
    const keys = Object.keys(counts);
    return (
      keys.length > 0 &&
      keys.every(
        (key) =>
          FCC.statKeys.includes(key) &&
          Number.isSafeInteger(counts[key]) &&
          counts[key] >= 0,
      )
    );
  }

  function handleMessage(message, services) {
    if (!FCC.isRecord(message) || typeof message.type !== "string") return undefined;

    switch (message.type) {
      case messageTypes.SETTINGS_GET:
        return services.getSettings().then((settings) => ({ ok: true, settings }));
      case messageTypes.SETTINGS_UPDATE:
        if (!validSettingsChanges(message.changes)) {
          return Promise.resolve({ ok: false, error: "Invalid settings update" });
        }
        return services
          .updateSettings(message.changes)
          .then((settings) => ({ ok: true, settings }));
      case messageTypes.SETTINGS_RESET:
        return services.resetSettings().then((settings) => ({ ok: true, settings }));
      case messageTypes.STATS_GET:
        return services.getStats().then((stats) => ({ ok: true, stats }));
      case messageTypes.STATS_INCREMENT:
        if (!validStatCounts(message.counts)) {
          return Promise.resolve({ ok: false, error: "Invalid stats increment" });
        }
        return services
          .incrementStats(message.counts)
          .then((stats) => ({ ok: true, stats }));
      case messageTypes.STATS_RESET:
        return services.resetStats().then((stats) => ({ ok: true, stats }));
      default:
        return undefined;
    }
  }

  Object.assign(FCC, {
    handleMessage,
    messageTypes,
    validSettingsChanges,
    validStatCounts,
  });
})(globalThis);
