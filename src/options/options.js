(function () {
  "use strict";

  const main = document.querySelector("main");
  const form = document.querySelector("#settings-form");
  const status = document.querySelector("#status");

  async function request(type, extra) {
    const response = await chrome.runtime.sendMessage({ type, ...extra });
    if (!response || !response.ok) throw new Error(response && response.error);
    return response;
  }

  function applySettings(settings) {
    for (const input of document.querySelectorAll("[data-setting]")) {
      input.checked = settings[input.dataset.setting];
    }
  }

  async function init() {
    FCC.localizeDocument(document);
    const [settingsResponse, statsResponse] = await Promise.all([
      request(FCC.messageTypes.SETTINGS_GET),
      request(FCC.messageTypes.STATS_GET),
    ]);
    applySettings(settingsResponse.settings);
    document.querySelector("#stat-total").textContent = statsResponse.stats.total.toLocaleString();
    document.querySelector("#settings-fields").disabled = false;
    main.setAttribute("aria-busy", "false");
  }

  form.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-setting]");
    if (!input) return;
    input.disabled = true;
    status.textContent = chrome.i18n.getMessage("saving");
    try {
      await request(FCC.messageTypes.SETTINGS_UPDATE, {
        changes: { [input.dataset.setting]: input.checked },
      });
      status.textContent = chrome.i18n.getMessage("saved");
    } catch {
      input.checked = !input.checked;
      status.textContent = chrome.i18n.getMessage("saveFailed");
    } finally {
      input.disabled = false;
    }
  });

  document.querySelector("#reset-settings").addEventListener("click", async () => {
    try {
      const response = await request(FCC.messageTypes.SETTINGS_RESET);
      applySettings(response.settings);
      status.textContent = chrome.i18n.getMessage("defaultsRestored");
    } catch {
      status.textContent = chrome.i18n.getMessage("saveFailed");
    }
  });

  document.querySelector("#reset-stats").addEventListener("click", async () => {
    try {
      const response = await request(FCC.messageTypes.STATS_RESET);
      document.querySelector("#stat-total").textContent = response.stats.total.toLocaleString();
      status.textContent = chrome.i18n.getMessage("statsCleared");
    } catch {
      status.textContent = chrome.i18n.getMessage("saveFailed");
    }
  });

  init().catch(() => {
    main.setAttribute("aria-busy", "false");
    status.textContent = chrome.i18n.getMessage("loadFailed");
  });
})();
