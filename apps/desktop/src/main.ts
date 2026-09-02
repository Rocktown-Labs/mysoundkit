import path from "node:path";
import { pathToFileURL } from "node:url";

import { app, BrowserWindow, ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import started from "electron-squirrel-startup";

/* oxlint-disable unicorn/prefer-module -- Forge's Vite main bundle uses CommonJS. */

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
    const window = new BrowserWindow({
      height: 760,
      minHeight: 560,
      minWidth: 860,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, "preload.js"),
        sandbox: true,
      },
      width: 1120,
    });

    mainWindow = window;

    window.webContents.on("will-navigate", (event, url) => {
      if (!isTrustedRendererUrl(url)) {
        event.preventDefault();
      }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      void window.loadFile(packagedRendererPath);
    }

    window.on("closed", () => {
      if (mainWindow === window) {
        mainWindow = null;
      }
    });
  },
  developmentRendererOrigin = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin
    : null,
  handleGetPlatform = (event: IpcMainInvokeEvent): string => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      throw new Error("Rejected IPC request from an unknown renderer.");
    }

    return process.platform;
  },
  isTrustedRendererUrl = (url: string): boolean => {
    if (url === packagedRendererUrl) {
      return true;
    }

    if (!developmentRendererOrigin) {
      return false;
    }

    try {
      return new URL(url).origin === developmentRendererOrigin;
    } catch {
      return false;
    }
  },
  packagedRendererPath = path.join(
    __dirname,
    `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
  ),
  packagedRendererUrl = pathToFileURL(packagedRendererPath).href;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

app.on("ready", () => {
  ipcMain.handle("desktop:get-platform", handleGetPlatform);
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common for
// applications to stay active until the user quits explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
