(function () {
  "use strict";

  const shell = document.querySelector(".shell");
  const fieldset = document.querySelector("#quick-settings");
  const pageStatus = document.querySelector("#page-status");
  const saveStatus = document.querySelector("#save-status");
  const rescanButton = document.querySelector("#rescan");
  let activeTab;

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

  function applyStats(stats) {
    for (const key of ["total", "sponsored", "reels", "suggested"]) {
      document.querySelector(`#stat-${key}`).textContent = stats[key].toLocaleString();
    }
  }

  function isFacebookTab(tab) {
    try {
      const url = new URL(tab.url);
      return url.protocol === "https:" && ["www.facebook.com", "web.facebook.com"].includes(url.hostname);
    } catch {
      return false;
    }
  }

  async function init() {
    FCC.localizeDocument(document);
    document.querySelector("#version").textContent = `v${chrome.runtime.getManifest().version}`;

    const [settingsResponse, statsResponse, tabs] = await Promise.all([
      request(FCC.messageTypes.SETTINGS_GET),
      request(FCC.messageTypes.STATS_GET),
      chrome.tabs.query({ active: true, currentWindow: true }),
    ]);

    applySettings(settingsResponse.settings);
    applyStats(statsResponse.stats);
    activeTab = tabs[0];
    const supported = activeTab && isFacebookTab(activeTab);
    pageStatus.textContent = chrome.i18n.getMessage(supported ? "facebookReady" : "facebookRequired");
    pageStatus.classList.toggle("warning", !supported);
    rescanButton.disabled = !supported;
    fieldset.disabled = false;
    shell.setAttribute("aria-busy", "false");
  }

  fieldset.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-setting]");
    if (!input) return;

    input.disabled = true;
    saveStatus.textContent = chrome.i18n.getMessage("saving");
    try {
      await request(FCC.messageTypes.SETTINGS_UPDATE, {
        changes: { [input.dataset.setting]: input.checked },
      });
      saveStatus.textContent = chrome.i18n.getMessage("saved");
    } catch {
      input.checked = !input.checked;
      saveStatus.textContent = chrome.i18n.getMessage("saveFailed");
    } finally {
      input.disabled = false;
    }
  });

  rescanButton.addEventListener("click", async () => {
    rescanButton.disabled = true;
    saveStatus.textContent = chrome.i18n.getMessage("rescanning");
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: FCC.messageTypes.CONTENT_RESCAN,
      });
      if (!response || !response.ok) throw new Error();
      saveStatus.textContent = chrome.i18n.getMessage("rescanComplete");
      applyStats((await request(FCC.messageTypes.STATS_GET)).stats);
    } catch {
      saveStatus.textContent = chrome.i18n.getMessage("cannotConnect");
    } finally {
      rescanButton.disabled = false;
    }
  });

  document.querySelector("#open-options").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  init().catch(() => {
    shell.setAttribute("aria-busy", "false");
    pageStatus.textContent = chrome.i18n.getMessage("loadFailed");
    pageStatus.classList.add("warning");
  });
})();
