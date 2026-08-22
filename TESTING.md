# Testing the mobile app against a real backend

There's no E2E automation suite yet. This documents a real, repeatable way to
drive the actual mobile app (not a mock, not a unit test) against the real
backend + real Postgres, screenshot it, and check for console errors —
established while verifying the Discover/Charger Detail/Booking Flow read
path against real data.

**This is strong supporting evidence for a change, not a substitute for
checking on a real device/simulator.** `react-native-web` renders through a
DOM/CSS engine, not each platform's real native renderer — layout edge cases,
gesture handling (pinch-zoom, pan, native `Pressable` touch behavior), and
platform-specific rendering quirks are not guaranteed identical to iOS/Android.
Treat a clean run here as proof the data/logic path works end-to-end; still
check on a real device or simulator before shipping anything layout- or
gesture-sensitive.

## Prerequisites

`react-native-web` and `@expo/metro-runtime` are already project
dependencies (`apps/mobile/package.json`, added when the login/register UI
was first built) — nothing extra to install. Confirmed live:
`npx expo export --platform web` completes cleanly from a stock `npm
install`, no missing-package errors.

You'll also need, per [DATABASE.md](DATABASE.md):
- The SSM tunnel open (`aws ssm start-session ...` — see DATABASE.md).
- The backend dev server running (`cd apps/backend && npm run start:dev`).

## Start the web preview

```bash
cd apps/mobile
npx expo start --web --port 8081
```

Wait for `Waiting on http://localhost:8081` in the log, or poll:

```bash
until curl -sf http://localhost:8081 >/dev/null; do sleep 2; done
```

`apps/mobile/.env`'s `EXPO_PUBLIC_API_URL` is normally set to this machine's
LAN IP (for physical-device testing) — that's fine for the web preview too,
since it's the same machine reaching its own IP.

## Drive it with Playwright

`playwright` is already an installed dependency (`node_modules/playwright`)
— no separate browser-automation tool needed. Run scripts with the repo's
`node_modules` on the resolution path:

```bash
NODE_PATH=/absolute/path/to/Kelo/node_modules node your-script.js
```

Minimal shape of a driver script:

```js
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto("http://localhost:8081", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder="you@example.com"]');
  await page.fill('input[placeholder="you@example.com"]', "you@example.com");
  await page.fill('input[placeholder="••••••••"]', "yourPassword123");
  await page.getByText("Log in", { exact: true }).click();
  await page.waitForSelector("text=Find a charger");

  await page.screenshot({ path: "discover.png" });
  console.log(consoleErrors);

  await browser.close();
})();
```

Login screen fields have no `testID`s — matched by placeholder text
(`you@example.com`, `••••••••`) and button label (`Log in`, exact match).
`page.getByText(...)` works across react-native-web's DOM regardless of
which native component something renders as. Use `page.innerText("body")`
and check `.includes(...)` for real values (a real address, an owner's
name) rather than screenshot-only verification when you need to assert on
exact text, not just "it looks right."

## Gotchas hit while doing this

- **CSS `text-transform: uppercase` changes `innerText`.** A label styled
  with `textTransform: "uppercase"` reports its *rendered* (uppercased) text
  via `page.innerText()`, not the original casing in the source string —
  match against the case actually rendered, or use a case-insensitive check.
- **`window.open` interception, not `<a href>` inspection**, for verifying
  `Linking.openURL()` calls. `react-native-web` doesn't render `Linking`
  targets as real anchor tags — evaluate a `window.open` monkey-patch before
  the click instead of reading `href` off the DOM afterward.
- **Fresh throwaway accounts per run**, registered via a direct
  `curl -X POST /auth/register` before launching the browser — real backend,
  real auth, no seed/fixture users. Clean up afterward the same way every
  other real-data test in this project does (delete the rows via `psql`
  through the tunnel) — respect foreign keys in delete order (Transaction /
  Session / ExtensionRequest → Booking → Charger → RefreshToken → User).
