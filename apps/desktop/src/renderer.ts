import "./index.css";

const loadPlatform = async (): Promise<void> => {
    if (!platformElement) {
      return;
    }

    try {
      const platform = await window.soundkitDesktop.getPlatform();
      platformElement.textContent = `Running on ${platform}.`;
    } catch {
      platformElement.textContent = "Platform information is unavailable.";
    }
  },
  platformElement = document.querySelector<HTMLElement>("#platform");

void loadPlatform();
