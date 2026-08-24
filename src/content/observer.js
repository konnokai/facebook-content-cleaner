(function (root) {
  "use strict";

  const FCC = root.FCC;
  const candidateSelector = [
    "[role='article']",
    "[role='dialog']",
    "[role='menu']",
    "[role='region'][aria-label]",
    "[data-fcc-facebook-kind]",
    "a[href*='/reel']",
    "a[href*='/groups/']",
    "a[href*='/events/birthdays']",
  ].join(",");
  const markerRuleKeys = Object.freeze({
    "friend-reel": "removeReels",
    sponsored: "removeSponsored",
    suggested: "removeSuggested",
  });

  function getHideTarget(element) {
    return (
      element.closest(
        "[role='article'], [role='listitem'], [role='dialog'], [role='menu'], [role='region'][aria-label], li",
      ) ||
      element.closest("[data-fcc-facebook-kind]") ||
      element
    );
  }

  function createPlaceholder(target, ruleKey) {
    const placeholder = document.createElement("div");
    placeholder.className = "fcc-placeholder";
    placeholder.dataset.fccPlaceholder = ruleKey;
    placeholder.textContent = chrome.i18n.getMessage("contentHidden") || "Content hidden by Feed Sieve";
    target.insertAdjacentElement("afterend", placeholder);
  }

  function hideTarget(target, rule, settings) {
    if (target.dataset.fccRule) return false;
    if (target.contains(document.activeElement)) document.activeElement.blur();
    target.classList.add("fcc-hidden");
    target.dataset.fccProcessed = "true";
    target.dataset.fccRule = rule.key;
    if (!settings.cleanMode) createPlaceholder(target, rule.key);
    return FCC.markCounted(target, rule.key);
  }

  function restoreTarget(target) {
    target.classList.remove("fcc-hidden");
    delete target.dataset.fccProcessed;
    delete target.dataset.fccRule;
    const placeholder = target.nextElementSibling;
    if (placeholder?.matches("[data-fcc-placeholder]")) placeholder.remove();
  }

  function restoreAll(container) {
    if (container.matches?.(".fcc-hidden[data-fcc-rule]")) restoreTarget(container);
    for (const element of container.querySelectorAll(".fcc-hidden[data-fcc-rule]")) {
      restoreTarget(element);
    }
    for (const placeholder of container.querySelectorAll("[data-fcc-placeholder]")) {
      placeholder.remove();
    }
  }

  function collectCandidates(scanRoot) {
    const candidates = [];
    if (scanRoot.nodeType === Node.ELEMENT_NODE && scanRoot.matches(candidateSelector)) {
      candidates.push(scanRoot);
    }
    if (scanRoot.querySelectorAll) candidates.push(...scanRoot.querySelectorAll(candidateSelector));
    return candidates;
  }

  function createScanner(getSettings, reportCounts) {
    function scan(scanRoot) {
      const settings = getSettings();
      if (!settings.enabled || !scanRoot) return;

      document.dispatchEvent(new CustomEvent("fcc:scan-facebook-data"));

      const counts = { reels: 0, sponsored: 0, suggested: 0, other: 0 };
      for (const candidate of collectCandidates(scanRoot)) {
        if (candidate.closest("[data-fcc-placeholder]")) continue;
        // A child link inside a marked card must not restore the card.
        const markedTarget = candidate.closest("[data-fcc-facebook-kind]");
        const markedKind = markedTarget?.dataset.fccFacebookKind;
        const markedRuleKey = markerRuleKeys[markedKind];
        if (markedTarget && markedTarget !== candidate && markedRuleKey && settings[markedRuleKey]) {
          continue;
        }
        const friendReel = candidate.closest("[data-fcc-facebook-kind='friend-reel']");
        const hiddenTarget = candidate.closest(".fcc-hidden[data-fcc-rule]");
        if (friendReel && settings.allowFriendsReels) {
          if (hiddenTarget) restoreTarget(hiddenTarget);
          continue;
        }
        const signals = FCC.collectSignals(candidate, location);
        const rule = FCC.findMatchingRule(signals, settings);
        if (hiddenTarget) {
          if (!rule) restoreTarget(hiddenTarget);
          continue;
        }
        if (!rule) continue;

        const target = getHideTarget(candidate);
        if (hideTarget(target, rule, settings)) counts[rule.stat] += 1;
      }

      if (Object.values(counts).some(Boolean)) return reportCounts(counts);
      return Promise.resolve();
    }

    function reapply(container) {
      restoreAll(container);
      return scan(container);
    }

    return { reapply, restore: restoreAll, scan };
  }

  function createContentObserver(scan) {
    return new MutationObserver((mutations) => {
      const roots = new Set();
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) roots.add(node);
            if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
              roots.add(node.parentElement.closest(candidateSelector) || node.parentElement);
            }
          }
        } else {
          const element =
            mutation.target.nodeType === Node.ELEMENT_NODE
              ? mutation.target
              : mutation.target.parentElement;
          if (element) roots.add(element.closest(candidateSelector) || element);
        }
      }
      for (const addedRoot of roots) scan(addedRoot);
    });
  }

  Object.assign(FCC, {
    candidateSelector,
    createContentObserver,
    createScanner,
    getHideTarget,
  });
})(globalThis);
