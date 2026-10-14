export interface DesktopAppInfo {
  buildType: "dev" | "packaged";
  platform: string;
  version: string;
}

declare global {
  interface Window {
    readonly soundkitDesktop: {
      getAppInfo: () => Promise<DesktopAppInfo>;
    };
  }
}
