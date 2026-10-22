(function (root) {
  "use strict";

  const marker = "data-fcc-facebook-kind";
  let rootElement;
  let reactKey;
  let scanPending = false;

  function classifyFeedUnit(feedUnit, unitTypename) {
    if (!feedUnit || typeof feedUnit !== "object") return "";
    if (feedUnit.sponsored_data?.ad_id || feedUnit.th_dat_spo != null) return "sponsored";
    if (
      feedUnit.actors?.[0]?.subscribe_status === "CAN_SUBSCRIBE" ||
      feedUnit.to?.viewer_forum_join_state === "CAN_JOIN" ||
      unitTypename === "GroupsYouShouldJoinFeedUnit"
    ) {
      return "suggested";
    }
    return "";
  }

  function hasSuggestedProfileAction(element, locationLike) {
    const profiles = [
      ...(element?.querySelectorAll("[data-ad-rendering-role='profile_name']") || []),
      ...(element?.querySelectorAll("header") || []),
    ];
    // Shared posts can contain another profile scope with its own join CTA.
    const profile = profiles[0];
    if (!profile) return false;
    const hasAction = ["[role='button']", "button", "a"].some((selector) =>
      [...profile.querySelectorAll(selector)].some((action) =>
        /^(加入|追蹤|join|follow)$/i.test(
          (action.innerText || action.textContent || "").trim(),
        ),
      ),
    );
    if (!hasAction) return false;

    // Follow and join actions are normal on posts inside the group currently open.
    const currentGroupPath = String(locationLike?.pathname || "").match(
      /^\/groups\/[^/]+/,
    )?.[0];
    if (!currentGroupPath) return true;
    return ![...profile.querySelectorAll("a[href]")].some((link) => {
      const path = String(link.pathname || "").replace(/\/+$/, "");
      return path === currentGroupPath || path.startsWith(`${currentGroupPath}/`);
    });
  }

  function hasResharedReel(fiber) {
    const stack = fiber?.child ? [fiber.child] : [];
    while (stack.length) {
      const current = stack.pop();
      if (
        componentName(current.type).includes("CometFeedStoryFBReelsAttachment") &&
        current.memoizedProps?.isReshare === true
      ) {
        return true;
      }
      if (current.child) stack.push(current.child);
      if (current.sibling) stack.push(current.sibling);
    }
    return false;
  }

  function getReactRoot() {
    if (!rootElement?.isConnected || !reactKey) {
      rootElement = [...document.querySelectorAll("[id^='mount_']")].find((element) => {
        reactKey = Object.getOwnPropertyNames(element).find((key) =>
          key.startsWith("__reactContainer$"),
        );
        return reactKey;
      });
    }
    const container = rootElement && rootElement[reactKey];
    return container?.stateNode?.current || container;
  }

  function findHostElement(fiber) {
    const stack = fiber.child ? [fiber.child] : [];
    while (stack.length) {
      const current = stack.pop();
      if (current.stateNode?.nodeType === Node.ELEMENT_NODE) return current.stateNode;
      if (current.sibling) stack.push(current.sibling);
      if (current.child) stack.push(current.child);
    }
    return null;
  }

  function getMarkerTarget(element) {
    return element?.closest("[role='dialog']") || element;
  }

  function componentName(type) {
    return typeof type === "function" ? type.displayName || type.name || "" : "";
  }

  function scanFacebookData() {
    const reactRoot = getReactRoot();
    if (!reactRoot) return;

    const marked = new Map();
    const stack = [reactRoot];
    while (stack.length) {
      const fiber = stack.pop();
      const props = fiber.memoizedProps;
      if (componentName(fiber.type).includes("CometFeedUnitErrorBoundary")) {
        const element = findHostElement(fiber);
        // Relay can omit recommendation fields while the rendered profile CTA remains available.
        const kind =
          (hasResharedReel(fiber) ? "friend-reel" : "") ||
          classifyFeedUnit(props?.feedUnit, props?.unitTypename) ||
          (hasSuggestedProfileAction(element, location) ? "suggested" : "");
        const target = getMarkerTarget(element);
        if (target && kind) marked.set(target, kind);
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }

    for (const element of marked.keys()) {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (marked.has(parent)) {
          marked.delete(element);
          break;
        }
      }
    }

    for (const element of document.querySelectorAll(`[${marker}]`)) {
      if (!marked.has(element)) element.removeAttribute(marker);
    }
    for (const [element, kind] of marked) {
      if (element.getAttribute(marker) !== kind) element.setAttribute(marker, kind);
    }
  }

  function requestScan() {
    if (scanPending) return;
    scanPending = true;
    queueMicrotask(() => {
      scanPending = false;
      scanFacebookData();
    });
  }

  root.FCCFacebookData = Object.freeze({
    classifyFeedUnit,
    hasResharedReel,
    hasSuggestedProfileAction,
    getMarkerTarget,
  });
  if (typeof document !== "undefined") {
    document.addEventListener("fcc:scan-facebook-data", requestScan);
  }
})(globalThis);
