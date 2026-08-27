(function (root) {
  "use strict";

  const FCC = root.FCC;

  const labels = Object.freeze({
    reels: ["reels", "reels and short videos", "連續短片", "連續短片和短片"],
    sponsored: ["sponsored", "贊助", "贊助內容"],
    suggested: ["suggested for you", "recommended for you", "為你推薦"],
    stories: ["stories", "限時動態"],
    suggestedGroups: ["suggested groups", "groups you might like", "推薦社團", "你可能會喜歡的社團"],
    birthdays: ["birthdays", "birthday reminders", "生日", "生日提醒"],
    notifications: ["notifications", "通知"],
    people: ["people you may know", "你可能認識的人"],
    friendReel: ["friend's reel", "reel from a friend", "好友的連續短片", "朋友的連續短片"],
  });

  function normalizeText(value) {
    return String(value || "")
      .replace(/[\u00a0\u200b-\u200d\ufeff]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
  }

  function hasPhrase(value, phrases) {
    const normalized = normalizeText(value);
    return phrases.some((phrase) => normalized.includes(phrase));
  }

  function listHasPhrase(values, phrases) {
    return values.some((value) => hasPhrase(value, phrases));
  }

  function collectAttributeValues(element, selector, attribute) {
    const values = [];
    if (element.matches && element.matches(selector)) {
      values.push(element.getAttribute(attribute));
    }
    for (const child of element.querySelectorAll(selector)) {
      values.push(child.getAttribute(attribute));
    }
    return values.filter(Boolean).map(normalizeText);
  }

  function collectText(element, selector) {
    const values = [];
    if (element.matches && element.matches(selector)) values.push(element.textContent);
    for (const child of element.querySelectorAll(selector)) values.push(child.textContent);
    return normalizeText(values.join(" "));
  }

  function isContentReelLink(link) {
    const href = normalizeText(link.getAttribute("href"));
    return (
      !link.closest("nav, [role='navigation'], [role='tablist'], [role='tab']") &&
      /\/reels?(?:\/|\?|$)/.test(href) &&
      !/[?&](?:comment_id|reply_comment_id)=/.test(href)
    );
  }

  function collectSignals(element, locationLike) {
    const role = normalizeText(element.getAttribute("role"));
    const links = [
      ...(element.matches?.("a[href]") ? [element] : []),
      ...element.querySelectorAll("a[href]"),
    ];
    const hrefs = links.map((link) => normalizeText(link.getAttribute("href"))).filter(Boolean);
    const labelsFound = collectAttributeValues(element, "[aria-label]", "aria-label");
    const headerText = collectText(element, "header, h1, h2, h3, h4, [role='heading']");
    const headerLabels = collectAttributeValues(
      element,
      "header [aria-label], h1 [aria-label], h2 [aria-label], h3 [aria-label], [role='heading'] [aria-label]",
      "aria-label",
    );
    const path = normalizeText(locationLike && locationLike.pathname);
    const isNavigation = Boolean(element.closest("nav, [role='navigation']"));

    return {
      role,
      path,
      isNavigation,
      text: normalizeText(element.textContent),
      headerText,
      labels: labelsFound,
      headerLabels,
      facebookKind: normalizeText(element.getAttribute("data-fcc-facebook-kind")),
      pagelet: normalizeText(element.getAttribute("data-pagelet")),
      reelSource: normalizeText(element.getAttribute("data-fcc-reel-source")),
      hrefs,
      isArticle: role === "article",
      isDialog: role === "dialog" || role === "menu",
      hasReelLink: links.some(isContentReelLink),
      hasAdLink: hrefs.some((href) => /\/(?:ads|ad_center)(?:\/|\?|$)/.test(href)),
    };
  }

  function sponsoredHeader(signals) {
    return (
      signals.facebookKind === "sponsored" ||
      signals.hasAdLink ||
      hasPhrase(signals.headerText, labels.sponsored) ||
      listHasPhrase(signals.headerLabels, labels.sponsored)
    );
  }

  function semanticSection(signals, sectionLabels) {
    return (
      !signals.isArticle &&
      (hasPhrase(signals.headerText, sectionLabels) ||
        listHasPhrase(signals.labels, sectionLabels))
    );
  }

  const rules = Object.freeze([
    {
      key: "removeReels",
      stat: "reels",
      matches(signals, settings) {
        const reel =
          !signals.isNavigation &&
          (signals.hasReelLink ||
            semanticSection(signals, labels.reels) ||
            listHasPhrase(signals.labels, labels.reels));
        const fromFriend =
          signals.facebookKind === "friend-reel" ||
          signals.reelSource === "friend" ||
          hasPhrase(signals.headerText, labels.friendReel) ||
          listHasPhrase(signals.labels, labels.friendReel);
        return reel && !(settings.allowFriendsReels && fromFriend);
      },
    },
    {
      key: "removeStories",
      stat: "other",
      matches: (signals) => semanticSection(signals, labels.stories),
    },
    {
      key: "removeSuggestedGroups",
      stat: "other",
      matches(signals) {
        return (
          semanticSection(signals, labels.suggestedGroups) ||
          signals.hrefs.some((href) => /\/groups\/(?:discover|suggestions)/.test(href))
        );
      },
    },
    {
      key: "removeBirthdayReminders",
      stat: "other",
      matches(signals) {
        return (
          semanticSection(signals, labels.birthdays) ||
          signals.hrefs.some((href) => /\/events\/birthdays/.test(href))
        );
      },
    },
    {
      key: "removePeopleYouMayKnow",
      stat: "other",
      matches: (signals) => semanticSection(signals, labels.people),
    },
    {
      key: "removeMarketplaceAds",
      stat: "other",
      matches(signals) {
        return signals.path.startsWith("/marketplace") && sponsoredHeader(signals);
      },
    },
    {
      key: "removeSearchAds",
      stat: "other",
      matches(signals) {
        return signals.path.startsWith("/search") && sponsoredHeader(signals);
      },
    },
    {
      key: "removeSponsored",
      stat: "sponsored",
      matches(signals) {
        return (
          !signals.path.startsWith("/marketplace") &&
          !signals.path.startsWith("/search") &&
          (signals.facebookKind === "sponsored" ||
            (signals.isArticle && sponsoredHeader(signals)))
        );
      },
    },
    {
      key: "removeSuggested",
      stat: "suggested",
      matches(signals) {
        return (
          signals.facebookKind === "suggested" ||
          (signals.isArticle && hasPhrase(signals.headerText, labels.suggested))
        );
      },
    },
    {
      key: "removeNotifications",
      stat: "other",
      matches(signals) {
        return (
          signals.isDialog &&
          (hasPhrase(signals.headerText, labels.notifications) ||
            listHasPhrase(signals.labels, labels.notifications))
        );
      },
    },
  ]);

  const markerRules = Object.freeze({
    sponsored: "removeSponsored",
    suggested: "removeSuggested",
  });

  function findMatchingRule(signals, settings) {
    if (!settings.enabled) return null;
    const markerRuleKey = markerRules[signals.facebookKind];
    if (markerRuleKey) {
      return settings[markerRuleKey]
        ? rules.find((rule) => rule.key === markerRuleKey) || null
        : null;
    }
    return rules.find((rule) => settings[rule.key] && rule.matches(signals, settings)) || null;
  }

  function markCounted(target, ruleKey) {
    if (target.dataset.fccCounted) return false;
    target.dataset.fccCounted = ruleKey;
    return true;
  }

  Object.assign(FCC, {
    collectSignals,
    findMatchingRule,
    isContentReelLink,
    labels,
    markCounted,
    normalizeText,
    rules,
  });
})(globalThis);
