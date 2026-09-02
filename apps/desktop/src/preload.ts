import { contextBridge, ipcRenderer } from "electron";

const soundkitDesktop = {
  getPlatform: (): Promise<string> =>
    ipcRenderer.invoke("desktop:get-platform"),
};

contextBridge.exposeInMainWorld("soundkitDesktop", soundkitDesktop);
