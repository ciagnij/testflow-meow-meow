# testflow meow meow

An open-source, readable edition of the supplied Testflow extension. Everything
the extension needs is bundled here. No backend, local server, account, license
key, API key, device registration, telemetry, or build step is required.

## Install

1. Download and extract this repository, or clone it with
   `git clone https://github.com/ciagnij/testflow-meow-meow.git`.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the folder containing `manifest.json`.
5. Disable the earlier Testflow extension to avoid applying two sets of patches.
6. Reload any already open supported pages.

Chrome 102+ or a Chromium browser with the equivalent extension APIs is required.
Firefox and Safari are not targeted by this edition. Node.js is needed only to
run development tests, not to install or use the extension.

The extension starts **enabled**. Its popup has an **Enable / Disable** button,
and that preference stays in `chrome.storage.local` across browser restarts.
After changing the setting, reload supported pages. Disabling stops injection
on subsequent loads; it cannot undo patches in a page that is already running.
The popup supports English and Polish based on the browser's UI language.

## What is local

The popup and background worker make no network requests. The only stored
setting is a boolean named `enabled`. There are no browser/device identifiers
or synced settings. The popup's content security policy includes
`connect-src 'none'`, and all executable code is bundled readable JavaScript.

The target websites are online services and still need their own internet
connection. On Wayground/Quizizz, a wrapper inspects requests the **page already
makes**, substitutes a local response for selected activity reports, and passes
other requests to the page's original `fetch`. It does not send extension data
to a backend or start any independent requests.

## Existing behavior retained

- **Testportal (`testportal.pl`, `testportal.net`):** freeze `Date.now()`,
  zero-argument `new Date()`, `Date()`, and `performance.now()` while the window
  is blurred; read the current time again when focused. Explicit date arguments,
  parsing, UTC conversion, and the native date prototype are preserved.
- **Wayground / Quizizz:** suppress focus and visibility notifications; expose a
  visible document and a fullscreen element; suppress fullscreen, resize,
  context-menu, copy, paste, and cut events; return a local success response for
  selected `createTestGameActivity` activity types.

These page modifications can affect timers, fullscreen UI, context menus, and
clipboard behavior. The scripts retain the supplied extension's scope: the
top-level page on the four supported domain families. They do not run on other
sites or in embedded frames. Site changes, different reporting transports, or
scripts that replace these APIs can change the result; no claim is made that
every form of site monitoring is disabled.

## Permissions and architecture

- `storage`: remember the local enable/disable preference.
- `scripting`: register or unregister the two bundled page scripts.
- Host access: only Testportal, Wayground, and Quizizz, including their
  subdomains, over HTTP/HTTPS. There is no activation-service host access.

`background.js` serializes settings changes and registers scripts with
`world: 'MAIN'`, `runAt: 'document_start'`, and `persistAcrossSessions: true`.
This replaces asynchronous license-gated DOM script injection. The browser
applies the scripts on new navigations without waiting for a server or popup.
See the [Chrome scripting API documentation](https://developer.chrome.com/docs/extensions/reference/api/scripting).

## Source layout

| File | Responsibility |
| --- | --- |
| `manifest.json` | Manifest V3, permissions, and local popup policy |
| `background.js` | Local state and page-script registration |
| `bypass.js` | Testportal clock behavior |
| `wayground-bypass.js` | Wayground/Quizizz page behavior |
| `popup.html`, `popup.css`, `popup.js` | Local settings UI |
| `_locales/` | English and Polish messages |
| `meow.webp` | Bundled popup mascot |

There is no generated `dist` directory, obfuscator, minifier, remote code,
or runtime dependency. Edit these source files directly, reload the extension
on the extensions page, and then reload the target page.

## Verification

Development test folders and `ANALYSIS.md` are kept locally and excluded from
Git. The automated commands below require the original development workspace
containing `tests/`; they are not available in a fresh clone of this repository.

With Node.js 18+ installed:

```sh
npm test
```

The suite exercises mocked Chrome lifecycle/storage APIs and page APIs, settings
failure recovery, date compatibility, event handling, request pass-through,
popup state/error flows, and packaging/localization. It makes no network requests. These checks do not
replace testing against current live website versions in a browser.

`npm run test:browser` additionally checks both page scripts against native
Chromium APIs using temporary HTML files and a separate headless browser profile,
without starting a server. It finds Chrome/Edge at their standard Windows paths;
on other systems set `TESTFLOW_BROWSER` to the browser executable. It checks page
API behavior, rather than installing the extension or testing live websites.

For a manual check: load unpacked, confirm the popup opens without a key, disable
and reload a supported page, enable and reload again, then restart the browser
and confirm the preference is retained. Check the extension's service-worker
console for registration errors. No service or API endpoint needs configuration.

## License

MIT; see `LICENSE`. This edition derives from the readable source supplied in
`masywna-wtyczka-new` and retains its bundled `icon128.png`.
