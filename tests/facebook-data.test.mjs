import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

await import("../src/content/facebook-data.js");

const {
  classifyFeedUnit,
  getMarkerTarget,
  hasResharedReel,
  hasSuggestedProfileAction,
} = globalThis.FCCFacebookData;

const suggestedProfileFixtures = await readFile(
  new URL("./fixtures/facebook-suggested-profile.html", import.meta.url),
  "utf8",
);

function suggestedProfileFixture(name) {
  const match = suggestedProfileFixtures.match(
    new RegExp(`<article([^>]*data-case="${name}"[^>]*)>([\\s\\S]*?)</article>`, "i"),
  );
  assert.ok(match, `Missing fixture: ${name}`);
  const pathname = match[1].match(/data-path="([^"]+)"/i)?.[1] || "";
  const href = match[2].match(/href="([^"]+)"/i)?.[1] || "";
  const action = match[2].match(/<button[^>]*>([^<]+)<\/button>/i)?.[1] || "";
  const profile = {
    querySelectorAll(selector) {
      if (selector === "a[href]") {
        return [{ pathname: new URL(href, "https://www.facebook.com").pathname }];
      }
      return selector === "[role='button']" ? [{ textContent: action }] : [];
    },
  };

  return {
    element: {
      querySelectorAll: (selector) =>
        selector === "[data-ad-rendering-role='profile_name']" ? [profile] : [],
    },
    location: { pathname },
  };
}

test("classifies Facebook sponsored feed data", () => {
  assert.equal(classifyFeedUnit({ sponsored_data: { ad_id: "ad" } }), "sponsored");
  assert.equal(classifyFeedUnit({ th_dat_spo: {} }), "sponsored");
  assert.equal(classifyFeedUnit({ th_dat_spo: null }), "");
});

test("classifies Facebook suggested feed data", () => {
  assert.equal(
    classifyFeedUnit({ actors: [{ subscribe_status: "CAN_SUBSCRIBE" }] }),
    "suggested",
  );
  assert.equal(
    classifyFeedUnit({ to: { viewer_forum_join_state: "CAN_JOIN" } }),
    "suggested",
  );
  assert.equal(classifyFeedUnit({}, "GroupsYouShouldJoinFeedUnit"), "suggested");
});

test("sponsored data takes precedence over suggested data", () => {
  assert.equal(
    classifyFeedUnit({
      sponsored_data: { ad_id: "ad" },
      actors: [{ subscribe_status: "CAN_SUBSCRIBE" }],
    }),
    "sponsored",
  );
});

test("classifies a rendered group or page CTA as suggested", () => {
  const button = (text) => ({ innerText: text });
  const profile = {
    querySelectorAll(selector) {
      return selector === "[role='button']" ? [button("加入")] : [];
    },
  };
  const host = {
    querySelectorAll(selector) {
      return selector === "[data-ad-rendering-role='profile_name']" ? [profile] : [];
    },
  };

  assert.equal(hasSuggestedProfileAction(host), true);
  assert.equal(hasSuggestedProfileAction({ querySelectorAll: () => [] }), false);
});

test("classifies a rendered group join link as suggested", () => {
  const profile = {
    querySelectorAll(selector) {
      return selector === "a" ? [{ textContent: "加入" }] : [];
    },
  };
  const host = {
    querySelectorAll(selector) {
      return selector === "[data-ad-rendering-role='profile_name']" ? [profile] : [];
    },
  };

  assert.equal(hasSuggestedProfileAction(host), true);
});

test("ignores follow actions on posts from the group currently open", () => {
  const suggested = suggestedProfileFixture("suggested-profile-positive");
  const groupPost = suggestedProfileFixture("suggested-profile-negative");

  assert.equal(hasSuggestedProfileAction(suggested.element, suggested.location), true);
  assert.equal(hasSuggestedProfileAction(groupPost.element, groupPost.location), false);
});

test("recognizes a Reel shared from another post", () => {
  function CometFeedStoryFBReelsAttachment() {}

  assert.equal(
    hasResharedReel({
      child: {
        type: CometFeedStoryFBReelsAttachment,
        memoizedProps: { isReshare: true },
      },
    }),
    true,
  );
  assert.equal(
    hasResharedReel({
      child: {
        type: CometFeedStoryFBReelsAttachment,
        memoizedProps: { isReshare: false },
      },
    }),
    false,
  );
});

test("promotes dialog markers to the hidden target", () => {
  const dialog = { closest: (selector) => (selector === "[role='dialog']" ? dialog : null) };
  assert.equal(getMarkerTarget(dialog), dialog);

  const host = { closest: () => dialog };
  assert.equal(getMarkerTarget(host), dialog);
});
