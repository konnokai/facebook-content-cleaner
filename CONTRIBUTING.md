# Contributing

Keep changes small and test the exact Facebook page structure they address.

## Before Opening a Change

1. Run `npm test`.
2. Run `npm run check`.
3. Load the extension unpacked and test the affected Facebook page.
4. Verify that turning the changed rule off restores the content.

## Rule Changes

- Prefer `role`, `aria-*`, stable link targets, and relative structure over generated CSS classes.
- Restrict text matching to confirmed headings, headers, navigation areas, or dialogs.
- Keep rules in `src/content/rules.js` until that file becomes difficult to maintain.
- Add one matching and one non-matching fixture for each changed rule.
- Remove names, account IDs, post text, image URLs, and tracking parameters from fixtures.
- Do not add remote rules, telemetry, broad host permissions, CSP changes, or dynamically executed code.

## Manual Test Notes

Include the test date, Facebook interface language, page type, and result. Do not include private account or post information.
