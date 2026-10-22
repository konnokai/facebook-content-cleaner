import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

await import("../src/shared/defaults.js");
await import("../src/shared/storage.js");
await import("../src/content/rules.js");
await import("../src/content/observer.js");

const FCC = globalThis.FCC;
const fixtureDirectory = new URL("./fixtures/", import.meta.url);

function attribute(source, name) {
  return source.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] || "";
}

function text(source) {
  return FCC.normalizeText(source.replace(/<[^>]+>/g, " "));
}

function parseFixtures(source) {
  const fixtures = new Map();
  const pattern = /<(article|section|div)([^>]*data-case="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of source.matchAll(pattern)) {
    const [, , outerAttributes, name, inner] = match;
    const whole = `${outerAttributes}>${inner}`;
    const links = [...whole.matchAll(/<a\b([^>]*)>/gi)]
      .map((value) => ({ attributes: value[1], href: attribute(value[1], "href") }))
      .filter((link) => link.href);
    const hrefs = links.map((link) => FCC.normalizeText(link.href));
    const labels = [...whole.matchAll(/aria-label="([^"]+)"/gi)].map((value) => FCC.normalizeText(value[1]));
    const headers = [...inner.matchAll(/<(?:header|h[1-4])[^>]*>([\s\S]*?)<\/(?:header|h[1-4])>/gi)];
    const headerSource = headers.map((value) => value[1]).join(" ");

    fixtures.set(name, {
      role: FCC.normalizeText(attribute(outerAttributes, "role")),
      path: FCC.normalizeText(attribute(outerAttributes, "data-path")),
      text: text(inner),
      headerText: text(headerSource),
      labels,
      headerLabels: [...headerSource.matchAll(/aria-label="([^"]+)"/gi)].map((value) => FCC.normalizeText(value[1])),
      facebookKind: FCC.normalizeText(attribute(outerAttributes, "data-fcc-facebook-kind")),
      pagelet: FCC.normalizeText(attribute(outerAttributes, "data-pagelet")),
      reelSource: FCC.normalizeText(attribute(outerAttributes, "data-fcc-reel-source")),
      hrefs,
      isArticle: FCC.normalizeText(attribute(outerAttributes, "role")) === "article",
      isDialog: ["dialog", "menu"].includes(FCC.normalizeText(attribute(outerAttributes, "role"))),
      isInDialog: ["dialog", "menu"].includes(FCC.normalizeText(attribute(outerAttributes, "role"))),
      hasReelLink: hrefs.some(
        (href, index) =>
          /\/reels?(?:\/|\?|$)/.test(href) &&
          !/\brole=["']tab["']/i.test(links[index].attributes) &&
          !/[?&](?:comment_id|reply_comment_id)=/.test(href),
      ),
      hasAdLink: hrefs.some((href) => /\/(?:ads|ad_center)(?:\/|\?|$)/.test(href)),
    });
  }
  return fixtures;
}

function settingsFor(ruleKey, overrides = {}) {
  const settings = { ...FCC.defaultSettings, enabled: true };
  for (const rule of FCC.rules) settings[rule.key] = false;
  settings[ruleKey] = true;
  return { ...settings, ...overrides };
}

const positive = parseFixtures(await readFile(new URL("positive.html", fixtureDirectory), "utf8"));
const negative = parseFixtures(await readFile(new URL("negative.html", fixtureDirectory), "utf8"));

for (const rule of FCC.rules) {
  test(`${rule.key} matches its positive fixture`, () => {
    assert.equal(FCC.findMatchingRule(positive.get(rule.key), settingsFor(rule.key))?.key, rule.key);
  });

  test(`${rule.key} ignores its negative fixture`, () => {
    assert.equal(FCC.findMatchingRule(negative.get(rule.key), settingsFor(rule.key)), null);
  });

  test(`${rule.key} does nothing when disabled`, () => {
    assert.equal(FCC.findMatchingRule(positive.get(rule.key), settingsFor(rule.key, { [rule.key]: false })), null);
  });
}

test("friends' Reels can be retained", () => {
  const settings = settingsFor("removeReels", { allowFriendsReels: true });
  assert.equal(FCC.findMatchingRule(positive.get("friendReel"), settings), null);
});

test("section and Reels rules ignore labels and links inside a notifications dialog", () => {
  for (const ruleKey of [
    "removeReels",
    "removeStories",
    "removeSuggestedGroups",
    "removeBirthdayReminders",
    "removePeopleYouMayKnow",
  ]) {
    assert.equal(
      FCC.findMatchingRule(negative.get("sectionLabelsInNotifications"), settingsFor(ruleKey)),
      null,
      ruleKey,
    );
  }
});

test("the same node is counted once", () => {
  const target = { dataset: {} };
  assert.equal(FCC.markCounted(target, "removeSponsored"), true);
  assert.equal(FCC.markCounted(target, "removeSponsored"), false);
});

test("people recommendation sections do not leave a replacement frame", () => {
  const previousDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  const target = {
    dataset: {},
    contains: () => false,
    classList: { add: () => undefined },
    insertAdjacentElement: () => assert.fail("unexpected replacement frame"),
  };

  try {
    assert.equal(
      FCC.hideTarget(
        target,
        { key: "removePeopleYouMayKnow", stat: "other" },
        { cleanMode: false },
      ),
      true,
    );
    assert.equal(target.dataset.fccRule, "removePeopleYouMayKnow");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("semantic sections hide their exclusive outer card", () => {
  const node = () => ({
    children: [],
    parentElement: null,
    matches: () => false,
    querySelector: () => null,
  });
  const append = (parent, ...children) => {
    parent.children.push(...children);
    for (const child of children) child.parentElement = parent;
    return parent;
  };
  const region = node();
  region.matches = (selector) => selector === "[role='region'][aria-label]";
  const content = append(node(), region);
  const heading = node();
  heading.matches = (selector) => selector.includes("header");
  const section = append(node(), heading, content);
  const frame = append(node(), section);

  assert.equal(FCC.getSectionHideTarget(region), frame);
  append(frame, node());
  assert.equal(FCC.getSectionHideTarget(region), section);
});

test("a settings change affects the next match immediately", () => {
  const signals = positive.get("removeSuggested");
  assert.equal(FCC.findMatchingRule(signals, settingsFor("removeSuggested"))?.key, "removeSuggested");
  assert.equal(FCC.findMatchingRule(signals, settingsFor("removeSponsored")), null);
});

test("Facebook internal markers match feed cards without article roles", () => {
  const signals = { ...negative.get("removeSponsored"), facebookKind: "sponsored" };
  assert.equal(FCC.findMatchingRule(signals, settingsFor("removeSponsored"))?.key, "removeSponsored");

  signals.facebookKind = "suggested";
  assert.equal(FCC.findMatchingRule(signals, settingsFor("removeSuggested"))?.key, "removeSuggested");
});

test("Reel navigation links are not hidden", () => {
  const signals = { ...positive.get("removeReels"), isNavigation: true };
  assert.equal(FCC.findMatchingRule(signals, settingsFor("removeReels")), null);
});

test("Reel tabs are not treated as content links", () => {
  const tab = {
    getAttribute: () => "/reel/?s=tab",
    closest: () => tab,
  };
  const content = {
    getAttribute: () => "/reel/102",
    closest: () => null,
  };

  assert.equal(FCC.isContentReelLink(tab), false);
  assert.equal(FCC.isContentReelLink(content), true);
});

test("Reel comment permalinks do not hide comment articles", () => {
  const settings = settingsFor("removeReels");
  assert.equal(
    FCC.findMatchingRule(positive.get("removeReelsWithComment"), settings)?.key,
    "removeReels",
  );
  assert.equal(FCC.findMatchingRule(negative.get("removeReelsComment"), settings), null);
});

test("Facebook suggested markers take priority over generic section labels", () => {
  const settings = {
    ...FCC.defaultSettings,
    enabled: true,
    removeSuggested: true,
    removeStories: true,
  };
  const signals = {
    ...negative.get("removeSuggested"),
    facebookKind: "suggested",
    headerText: "限時動態",
  };

  assert.equal(FCC.findMatchingRule(signals, settings)?.key, "removeSuggested");
  assert.equal(
    FCC.findMatchingRule(signals, { ...settings, removeSuggested: false }),
    null,
  );
});

test("allowFriendsReels keeps a marked reshared Reel", () => {
  const signals = { ...positive.get("removeReels"), facebookKind: "friend-reel" };
  assert.equal(
    FCC.findMatchingRule(signals, settingsFor("removeReels", { allowFriendsReels: true })),
    null,
  );
  assert.equal(
    FCC.findMatchingRule(signals, settingsFor("removeReels", { allowFriendsReels: false }))?.key,
    "removeReels",
  );
});

test("retained friend Reel children are restored instead of skipped", () => {
  const parent = {};
  const child = {};
  assert.equal(
    FCC.shouldSkipMarkedChild(child, parent, "friend-reel", {
      removeReels: true,
      allowFriendsReels: true,
    }),
    false,
  );
  assert.equal(
    FCC.shouldSkipMarkedChild(child, parent, "friend-reel", {
      removeReels: true,
      allowFriendsReels: false,
    }),
    true,
  );
  assert.equal(
    FCC.shouldSkipMarkedChild(child, parent, "suggested", {
      removeSuggested: true,
      allowFriendsReels: true,
    }),
    true,
  );
});
