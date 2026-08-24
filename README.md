# Feed Sieve

Feed Sieve is a small Chrome extension that hides selected clutter on the desktop Facebook website. It runs locally, stores settings and counts in the current Chrome profile, and does not use an account or remote service.

This project is independent and is not endorsed by Meta or Facebook. Facebook is a trademark of Meta Platforms, Inc.

## Features

- Hide Reels, sponsored posts, suggested posts, Stories, suggested groups, birthday reminders, notification overlays, and people recommendations.
- Hide sponsored Marketplace listings and Facebook search results.
- Keep Reels that Facebook explicitly identifies as coming from a friend.
- Show a small replacement notice, or remove the notice with Clean mode.
- Save settings and hidden-item counts in `chrome.storage.local`.
- Rescan the current Facebook tab from the popup.
- English and Traditional Chinese interface text.

Facebook changes its page structure often. Detection uses semantic attributes, link targets, relative structure, and a small set of English and Traditional Chinese labels. Rules may need maintenance when Facebook changes those signals.

## Install From Source

1. Download or clone this folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on Developer mode.
4. Select **Load unpacked**.
5. Choose the `facebook-content-cleaner` folder.
6. Open or reload `https://www.facebook.com/` or `https://web.facebook.com/`.

Chrome may require the Facebook tab to be reloaded after the extension is installed or updated.

## Development

Requirements: a current Node.js release and Google Chrome.

Run the automated tests:

```sh
npm test
```

Check the manifest, locale JSON, JavaScript syntax, permissions, and extension CSP rules:

```sh
npm run check
```

The extension has no runtime or development dependencies. Source files are loaded directly by Chrome; there is no build step.

## Manual Checks

Use a test account or content that does not expose private data in screenshots or reports.

1. Load the unpacked extension in a new Chrome profile.
2. Confirm the Service Worker registers without an error.
3. Open the popup and Options page using both keyboard and mouse.
4. Test the home feed, Reels, Marketplace, search results, group suggestions, and long scrolling sessions.
5. Turn each rule on and off without reloading the Facebook page.
6. Confirm hidden content returns when its rule or the main switch is turned off.
7. Restart Chrome and confirm settings and statistics remain.
8. In DevTools, confirm the content script does not run a timer-based full-document scan or create an observer loop.

Record the date, Facebook language, page type, and result. Do not record account IDs, names, post text, image URLs, or tracking parameters.

## Packaging

Run this command from the project directory in Windows PowerShell:

```powershell
Compress-Archive -Path manifest.json,src,_locales,README.md,PRIVACY.md,LICENSE -DestinationPath feed-sieve-1.0.0.zip
```

Delete an older ZIP with the same name before running the command again. The ZIP is only a source package; Chrome Web Store submission still needs reviewed release artwork and store metadata.

## Project Layout

- `src/background.js`: validated runtime messages and serialized statistic writes.
- `src/content/rules.js`: all content detection rules.
- `src/content/observer.js`: shared scanning, hiding, restoring, and counting.
- `src/content/index.js`: content-script startup and live setting updates.
- `src/popup/` and `src/options/`: native HTML, CSS, and JavaScript interfaces.
- `tests/fixtures/`: de-identified HTML samples used by rule tests.

## Privacy

See [PRIVACY.md](PRIVACY.md). The extension does not read Facebook cookies, tokens, `localStorage`, or IndexedDB, and it does not send browsing or page data anywhere.

## License

[MIT](LICENSE)
