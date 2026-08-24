# Privacy Policy

Feed Sieve works entirely inside the user's browser.

## Data Stored

The extension stores these items in `chrome.storage.local`:

- Feature settings.
- Counts of hidden Reels, sponsored posts, suggested posts, and other matched sections.
- A local storage format version.

This data stays in the current Chrome profile. It is not synchronized by the extension and can be reset from the Options page.

## Data Not Collected

Feed Sieve does not collect or transmit:

- Browsing history.
- Facebook account IDs, names, posts, messages, friends, or images.
- Cookies, access tokens, `localStorage`, or IndexedDB data.
- Analytics, diagnostics, advertising identifiers, or usage events.

## Network Access

The extension does not contact a developer server or load remote code. Chrome may make its normal browser and extension-update requests independently of this extension.

## Permissions

- `storage`: saves settings and local statistics.
- `activeTab`: lets the popup ask the current Facebook tab to rescan after the user clicks the button.
- `https://www.facebook.com/*` and `https://web.facebook.com/*`: runs the content cleaner on the supported desktop websites.

## Changes

Material privacy changes will be listed in `CHANGELOG.md` and included with the source release.
