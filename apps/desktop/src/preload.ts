import { contextBridge, ipcRenderer } from "electron";

import type { DesktopAppInfo } from "./window";

const soundkitDesktop = {
  getAppInfo: (): Promise<DesktopAppInfo> =>
    ipcRenderer.invoke("desktop:get-app-info"),
};

contextBridge.exposeInMainWorld("soundkitDesktop", soundkitDesktop);
