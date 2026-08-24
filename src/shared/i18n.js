(function (root) {
  "use strict";

  function localizeDocument(container) {
    const i18n = root.chrome && root.chrome.i18n;
    if (i18n) {
      for (const element of container.querySelectorAll("[data-i18n]")) {
        const message = i18n.getMessage(element.dataset.i18n);
        if (message) element.textContent = message;
      }
      document.documentElement.lang = i18n.getUILanguage().replace("_", "-");
    }

    for (const input of container.querySelectorAll("input[data-setting]")) {
      const label = input.closest("label");
      const name = label && (label.querySelector("strong") || label.querySelector("span"));
      if (name) input.setAttribute("aria-label", name.textContent.trim());
    }
  }

  root.FCC = Object.assign(root.FCC || {}, { localizeDocument });
})(globalThis);
