(function () {
  "use strict";

  let settings = { ...FCC.defaultSettings };
  let observer;
  let scanner;

  function reportCounts(counts) {
    return chrome.runtime
      .sendMessage({ type: FCC.messageTypes.STATS_INCREMENT, counts })
      .catch(() => undefined);
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = FCC.createContentObserver((root) => scanner.scan(root));
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "aria-label",
        "data-fcc-facebook-kind",
        "data-pagelet",
        "href",
        "role",
      ],
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  function applySettings(nextSettings) {
    settings = FCC.mergeSettings(nextSettings);
    if (!document.body) return;

    if (!settings.enabled) {
      if (observer) observer.disconnect();
      observer = undefined;
      scanner.restore(document.body);
      return;
    }

    scanner.reapply(document.body);
    startObserver();
  }

  async function init() {
    settings = await FCC.getSettings();
    scanner = FCC.createScanner(() => settings, reportCounts);
    applySettings(settings);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.settings && scanner) {
      applySettings(changes.settings.newValue);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!FCC.isRecord(message) || message.type !== FCC.messageTypes.CONTENT_RESCAN) {
      return false;
    }
    if (!scanner || !document.body) {
      sendResponse({ ok: false, error: "Content script is not ready" });
      return false;
    }
    scanner
      .reapply(document.body)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  init().catch((error) => console.error("Feed Sieve failed to start", error));
})();
