import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

await import("../src/shared/defaults.js");
await import("../src/shared/storage.js");
await import("../src/content/rules.js");

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
    const hrefs = [...whole.matchAll(/href="([^"]+)"/gi)].map((value) => FCC.normalizeText(value[1]));
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
      hasReelLink: hrefs.some((href) => /\/reels?(?:\/|\?|$)/.test(href)),
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

test("the same node is counted once", () => {
  const target = { dataset: {} };
  assert.equal(FCC.markCounted(target, "removeSponsored"), true);
  assert.equal(FCC.markCounted(target, "removeSponsored"), false);
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
