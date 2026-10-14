import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  screen,
  session,
  shell,
} from "electron";
import type {
  IpcMainInvokeEvent,
  MenuItemConstructorOptions,
  Session,
} from "electron";
import started from "electron-squirrel-startup";

import { DEFAULT_APP_URL, resolveAppUrl } from "./lib/app-config";
import { DEEP_LINK_SCHEME, parseDeepLink } from "./lib/deep-link";
import { createNavigationPolicy } from "./lib/navigation-policy";
import {
  stripDesktopTokensFromClientHints,
  stripDesktopTokensFromUserAgent,
} from "./lib/user-agent";
import { clampWindowBounds, MIN_WINDOW_SIZE } from "./lib/window-state";
import type { WindowBounds } from "./lib/window-state";
import type { DesktopAppInfo } from "./window";

/* oxlint-disable unicorn/prefer-module -- Forge's Vite main bundle uses CommonJS. */
/* oxlint-disable eslint/one-var, eslint/sort-vars -- declarator order follows data dependencies; the shell wiring reads best grouped by concern. */
/* oxlint-disable promise/prefer-await-to-callbacks -- Electron's session, permission, webRequest, and download APIs are callback-based by contract. */
/* oxlint-disable node/no-sync -- window-state persistence reads/writes a tiny state file on the startup path, where sync fs is the Electron convention. */

/**
 * The desktop app is a hardened shell around the production SoundKit web app:
 * the renderer runs on the real https://mysoundkit.com origin, so every
 * route, feature, and future release (merch, live, dashboard) ships to the
 * desktop the moment it ships to the web — no separate client to keep in
 * sync, and every auth flow (better-auth cookies, Turnstile, Google OAuth,
 * Stripe) behaves exactly as it does in the browser.
 */
const appUrl = resolveAppUrl(process.env.SOUNDKIT_APP_URL ?? DEFAULT_APP_URL),
  appUserModelId = "com.rocktonlabs.soundkit.desktop",
  developmentRendererOrigin = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin
    : null,
  isDevelopment = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL),
  navigationPolicy = createNavigationPolicy({
    appUrl,
    devOrigin: developmentRendererOrigin,
  }),
  /**
   * Site-adjacent dark background (the web app theme background) so the
   * window never flashes white before the first paint.
   */
  windowBackgroundColor = "#0d0d0d",
  /**
   * Playwright-only seams: the desktop shell suite runs the real main
   * process, but must not plaster windows, Dock icons, or system-browser
   * tabs across a developer's desktop while it does.
   */
  startHidden = process.env.SOUNDKIT_START_HIDDEN === "1",
  suppressExternalOpen = process.env.SOUNDKIT_DISABLE_EXTERNAL_OPEN === "1",
  allowedPermissions = new Set([
    "media",
    "notifications",
    "fullscreen",
    "clipboard-sanitized-write",
  ]),
  googleRequestFilter = { urls: ["*://*.google.com/*"] },
  errorPageUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/error.html`
    : pathToFileURL(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/error.html`)
      ).href,
  ERR_ABORTED_CODE = -3;

let mainWindow: BrowserWindow | null = null,
  pendingDeepLinkUrl: string | null = null;

const isErrorPageUrl = (url: string): boolean => url.startsWith(errorPageUrl),
  windowStateFilePath = (): string =>
    path.join(app.getPath("userData"), "window-state.json"),
  loadSavedWindowBounds = (): Partial<WindowBounds> => {
    try {
      return JSON.parse(
        fs.readFileSync(windowStateFilePath(), "utf-8")
      ) as Partial<WindowBounds>;
    } catch {
      return {};
    }
  },
  saveWindowBounds = (bounds: WindowBounds): void => {
    try {
      fs.mkdirSync(app.getPath("userData"), { recursive: true });
      fs.writeFileSync(windowStateFilePath(), JSON.stringify(bounds));
    } catch {
      // Best-effort persistence: a lost window state never blocks startup.
    }
  },
  openExternally = (url: string): void => {
    if (suppressExternalOpen) {
      return;
    }

    // Best-effort handoff: a machine without a handler for the scheme must
    // not surface an unhandled rejection.
    void (async () => {
      try {
        await shell.openExternal(url);
      } catch {
        // Swallowed deliberately — see above.
      }
    })();
  },
  reloadSurface = (window: BrowserWindow): void => {
    if (isErrorPageUrl(window.webContents.getURL())) {
      void window.loadURL(appUrl);
      return;
    }

    window.webContents.reload();
  },
  loadErrorPage = (window: BrowserWindow, failedUrl: string): void => {
    const retryTarget = navigationPolicy.isAllowedInWindow(failedUrl)
        ? failedUrl
        : appUrl,
      errorUrl = new URL(errorPageUrl);

    errorUrl.searchParams.set("target", retryTarget);
    void window.loadURL(errorUrl.toString());
  },
  /**
   * Applies the shell's security posture to the session: a tight permission
   * allowlist (live rooms need mic/cam, the site posts notifications, video
   * wants fullscreen), a User-Agent without Electron tokens — Google blocks
   * OAuth in embedded browsers it can fingerprint — and a save dialog for
   * downloads instead of silent drops into ~/Downloads.
   */
  configureSession = (browserSession: Session): void => {
    browserSession.setPermissionRequestHandler(
      (_contents, permission, callback) => {
        callback(allowedPermissions.has(permission));
      }
    );
    browserSession.setPermissionCheckHandler((_contents, permission) =>
      allowedPermissions.has(permission)
    );
    browserSession.setUserAgent(
      stripDesktopTokensFromUserAgent(browserSession.getUserAgent())
    );
    browserSession.webRequest.onBeforeSendHeaders(
      googleRequestFilter,
      (details, callback) => {
        const clientHints = details.requestHeaders["sec-ch-ua"];

        if (clientHints) {
          details.requestHeaders["sec-ch-ua"] =
            stripDesktopTokensFromClientHints(clientHints);
        }

        callback({ requestHeaders: details.requestHeaders });
      }
    );
    browserSession.on("will-download", (_event, item) => {
      item.setSaveDialogOptions({ defaultPath: item.getFilename() });
      item.once("done", (_doneEvent, state) => {
        if (state !== "completed" || !Notification.isSupported()) {
          return;
        }

        new Notification({
          body: item.getSavePath(),
          title: "Download complete",
        }).show();
      });
    });
  },
  buildAppMenu = (window: BrowserWindow): Menu => {
    const template: MenuItemConstructorOptions[] = [
      ...(process.platform === "darwin"
        ? ([
            {
              label: app.name,
              submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
              ],
            },
          ] satisfies MenuItemConstructorOptions[])
        : []),
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          {
            accelerator: "CmdOrCtrl+R",
            click: () => reloadSurface(window),
            label: "Reload SoundKit",
          },
          {
            accelerator: "Shift+CmdOrCtrl+R",
            click: () => window.webContents.reloadIgnoringCache(),
            label: "Force Reload",
          },
          ...(isDevelopment
            ? ([
                { role: "toggleDevTools" },
              ] satisfies MenuItemConstructorOptions[])
            : []),
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      { role: "windowMenu" },
    ];

    return Menu.buildFromTemplate(template);
  },
  createWindow = (): void => {
    const bounds = clampWindowBounds(
        loadSavedWindowBounds(),
        screen.getPrimaryDisplay().workArea
      ),
      window = new BrowserWindow({
        backgroundColor: windowBackgroundColor,
        height: bounds.height,
        minHeight: MIN_WINDOW_SIZE.height,
        minWidth: MIN_WINDOW_SIZE.width,
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, "preload.js"),
          sandbox: true,
        },
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
      });

    mainWindow = window;

    if (!startHidden) {
      window.once("ready-to-show", () => {
        window.show();
      });
    }

    window.webContents.on("will-navigate", (event, url) => {
      if (navigationPolicy.isAllowedInWindow(url)) {
        return;
      }

      event.preventDefault();

      if (navigationPolicy.canOpenExternally(url)) {
        openExternally(url);
      }
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (navigationPolicy.isAllowedInWindow(url)) {
        // Popups inherit the opener's webPreferences (sandbox, contextIsolation,
        // preload), so OAuth or helper windows keep the same security posture.
        return { action: "allow" };
      }

      if (navigationPolicy.canOpenExternally(url)) {
        openExternally(url);
      }

      return { action: "deny" };
    });

    // The web app never embeds <webview>; refusing attachment keeps the
    // renderer surface auditable.
    window.webContents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });

    window.webContents.on(
      "did-fail-load",
      (_event, errorCode, _errorDescription, failedUrl, isMainFrame) => {
        if (
          !isMainFrame ||
          errorCode === ERR_ABORTED_CODE ||
          isErrorPageUrl(failedUrl)
        ) {
          return;
        }

        loadErrorPage(window, failedUrl);
      }
    );

    window.webContents.on("render-process-gone", (_event, details) => {
      if (details.reason === "clean-exit") {
        return;
      }

      reloadSurface(window);
    });

    if (isDevelopment) {
      // The dev renderer redirects to the app URL, keeping the error page
      // available at /error.html for iteration.
      void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      void window.loadURL(appUrl);
    }

    window.on("close", () => {
      saveWindowBounds(window.getBounds());
    });

    window.on("closed", () => {
      if (mainWindow === window) {
        mainWindow = null;
      }
    });

    Menu.setApplicationMenu(buildAppMenu(window));
  },
  focusMainWindow = (): void => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  },
  handleDeepLink = (rawUrl: string): void => {
    const targetUrl = parseDeepLink(rawUrl, appUrl);

    if (!targetUrl) {
      return;
    }

    focusMainWindow();

    if (mainWindow) {
      void mainWindow.loadURL(targetUrl);
    }
  },
  handleGetAppInfo = (event: IpcMainInvokeEvent): DesktopAppInfo => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      throw new Error("Rejected IPC request from an unknown renderer.");
    }

    return {
      buildType: isDevelopment ? "dev" : "packaged",
      platform: process.platform,
      version: app.getVersion(),
    };
  };

if (process.env.SOUNDKIT_USER_DATA_DIR) {
  // Overridden before the app is ready so tests can isolate sessions.
  app.setPath("userData", process.env.SOUNDKIT_USER_DATA_DIR);
}

app.name = "SoundKit";
app.setAppUserModelId(appUserModelId);

if (started) {
  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  app.quit();
} else if (app.requestSingleInstanceLock()) {
  app.on("second-instance", (_event, argv) => {
    const deepLinkUrl = argv.find((argument) =>
      argument.startsWith(`${DEEP_LINK_SCHEME}://`)
    );

    focusMainWindow();

    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  });

  app.on("open-url", (event, url) => {
    // macOS delivers launch URLs through this event, sometimes before ready.
    event.preventDefault();

    if (app.isReady()) {
      handleDeepLink(url);
    } else {
      pendingDeepLinkUrl = url;
    }
  });

  app.on("window-all-closed", () => {
    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications to stay active until the user quits explicitly with
    // Cmd + Q.
    if (process.platform === "darwin") {
      return;
    }

    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  void (async () => {
    await app.whenReady();

    if (startHidden && process.platform === "darwin" && app.dock) {
      app.dock.hide();
    }

    if (process.platform === "linux" || process.platform === "win32") {
      // macOS registers the protocol through Info.plist (packagerConfig.protocols).
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
    }

    configureSession(session.defaultSession);
    ipcMain.handle("desktop:get-app-info", handleGetAppInfo);
    createWindow();

    if (pendingDeepLinkUrl) {
      const launchUrl = pendingDeepLinkUrl;
      pendingDeepLinkUrl = null;
      handleDeepLink(launchUrl);
    }
  })();
} else {
  app.quit();
}
