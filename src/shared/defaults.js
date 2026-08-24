(function (root) {
  "use strict";

  const defaultSettings = Object.freeze({
    enabled: true,
    removeReels: true,
    allowFriendsReels: false,
    removeSponsored: true,
    removeSuggested: false,
    removeMarketplaceAds: true,
    removeSearchAds: true,
    removeStories: false,
    removeSuggestedGroups: false,
    removeBirthdayReminders: false,
    removeNotifications: false,
    removePeopleYouMayKnow: false,
    cleanMode: false,
  });

  const defaultStats = Object.freeze({
    reels: 0,
    sponsored: 0,
    suggested: 0,
    other: 0,
    total: 0,
  });

  const statKeys = Object.freeze([
    "reels",
    "sponsored",
    "suggested",
    "other",
  ]);

  root.FCC = Object.assign(root.FCC || {}, {
    STORAGE_VERSION: 1,
    defaultSettings,
    defaultStats,
    settingKeys: Object.freeze(Object.keys(defaultSettings)),
    statKeys,
  });
})(globalThis);
