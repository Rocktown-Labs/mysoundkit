/* eslint-disable one-var, sort-vars */
export interface YouTubePlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  isMuted: () => boolean;
  mute: () => void;
  unMute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}

interface YouTubeEvent {
  data: number;
  target: YouTubePlayer;
}

interface YouTubePlayerOptions {
  events: {
    onAutoplayBlocked: () => void;
    onError: (event: YouTubeEvent) => void;
    onReady: (event: { target: YouTubePlayer }) => void;
    onStateChange: (event: YouTubeEvent) => void;
  };
  height: string;
  playerVars: {
    autoplay: number;
    origin: string;
    playsinline: number;
    rel: number;
  };
  videoId: string;
  width: string;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: YouTubeApi;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

export const loadYouTubePlayerApi = (): Promise<YouTubeApi> => {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) {
    return apiPromise;
  }
  // Browser script readiness is callback-driven; this promise bridges the provider API.
  // eslint-disable-next-line promise/avoid-new
  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady,
      script = document.createElement("script"),
      fail = () => {
        window.clearTimeout(timer);
        apiPromise = null;
        script.remove();
        reject(
          new Error(
            "YouTube could not load. Check your connection and try again."
          )
        );
      },
      timer = window.setTimeout(fail, 15_000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer);
      try {
        previous?.();
      } finally {
        if (window.YT?.Player) {
          resolve(window.YT);
        } else {
          fail();
        }
      }
    };
    script.async = true;
    script.src = "https://www.youtube.com/iframe_api";
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  });
  return apiPromise;
};
