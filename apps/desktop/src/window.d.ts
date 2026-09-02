interface Window {
  soundkitDesktop: {
    getPlatform: () => Promise<string>;
  };
}
