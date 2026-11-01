export interface VideoPlaybackHandle {
  toggleMute: () => void;
  pause: () => void;
  play: () => void;
  requestPictureInPicture: () => Promise<boolean>;
  seek: (seconds: number) => void;
}
