# SoundKit Desktop

The SoundKit desktop application (product name: **SoundKit**): a hardened [Electron](https://www.electronjs.org/) shell around the production web app. The window loads `https://mysoundkit.com` directly, so the desktop app is a 1-1 clone of the web experience by construction — every public route, the artist dashboard, live rooms, and the merch studio — and picks up every web release (including features shipped by other agents) with no separate client to keep in sync.

## Why a shell

- **Parity is guaranteed.** The renderer runs on the real origin, so all auth (better-auth cookies, Turnstile, Google OAuth, Stripe Connect), the persistent player, WebRTC live rooms, and SSR behave exactly as they do in the browser.
- **No client-side port.** Rebuilding the site client-side would mean rewriting the dashboard server-function guards, registering a custom origin with the API, CORS, Turnstile, and Google OAuth, and paying a rebuild+release tax on every future web feature.

## Shell behavior

| Concern                 | Behavior                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App URL                 | `https://mysoundkit.com`; override with `SOUNDKIT_APP_URL` (http/https only)                                                                                                                |
| Navigation              | Locked to `mysoundkit.com` + subdomains (the better-auth social redirect passes through `api.mysoundkit.com`) and `accounts.google.com`; anything else opens in the system browser          |
| Popups                  | Denied unless app-origin; external http(s)/`mailto:`/`tel:` hand off to the system browser                                                                                                  |
| Permissions             | Only `media`, `notifications`, `fullscreen`, `clipboard-sanitized-write`                                                                                                                    |
| User-Agent              | Electron/desktop tokens stripped so Google OAuth clears the embedded-browser gate (`sec-ch-ua` scrubbed for `*.google.com`)                                                                 |
| Offline / load failures | Bundled dark error page (`error.html`) with a retry that returns to the attempted route                                                                                                     |
| Downloads               | Save dialog + completion notification                                                                                                                                                       |
| Deep links              | `soundkit://` registered (macOS `open-url`, Windows/Linux second-instance argv), validated against traversal/encoded input                                                                  |
| Window state            | Persisted to `userData/window-state.json`, clamped to visible displays                                                                                                                      |
| Instances               | Single-instance lock; a second launch focuses the existing window and forwards deep links                                                                                                   |
| Security posture        | `sandbox: true`, `contextIsolation: true`, no `nodeIntegration`, webview attachment refused, Fuses (no RunAsNode, cookie encryption, asar integrity, `OnlyLoadAppFromAsar`, no `--inspect`) |

## Commands

```bash
pnpm run dev:desktop        # electron-forge start (dev renderer redirects to the app URL)
pnpm --filter desktop run package   # package for the current OS
pnpm --filter desktop run make      # platform installers (Squirrel/DMG/deb/rpm/zip)
pnpm --filter desktop run icons     # regenerate src/icons from apps/website/public/icon.svg
pnpm run test:desktop       # Playwright shell smoke suite (offline, invisible)
```

## Testing seams

The Playwright suite runs the real main process through the unfused dev Electron binary (the packaged app disables `--inspect` via Fuses, which Playwright needs). Two env flags keep the suite from disturbing the desktop while it runs — `SOUNDKIT_START_HIDDEN=1` (windows never show, no Dock icon) and `SOUNDKIT_DISABLE_EXTERNAL_OPEN=1` (external handoffs are suppressed). `SOUNDKIT_USER_DATA_DIR` isolates each run's profile.

## Release

Push a `v*` tag (or dispatch **Desktop Release** in Actions): unsigned artifacts build for macOS (arm64 + x64 DMG/zip), Windows (Squirrel), and Linux (deb/rpm/zip) and attach to a GitHub Release. Code signing, notarization, and runtime auto-update land once signing credentials exist (#417 follow-up).
