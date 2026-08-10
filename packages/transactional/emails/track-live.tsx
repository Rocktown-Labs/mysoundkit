import { TrackLifecycleEmail } from "../src/index";
import type { TrackLifecycleEmailProps } from "../src/index";

const TrackLiveEmail = TrackLifecycleEmail as typeof TrackLifecycleEmail & {
  PreviewProps: TrackLifecycleEmailProps;
};

TrackLiveEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/tracks/demo-track",
  artistName: "MetroFlow",
  assetBaseUrl: "https://mysoundkit.com",
  previewText: "Midnight Bounce is ready in your SoundKit dashboard.",
  trackTitle: "Midnight Bounce",
} satisfies TrackLifecycleEmailProps;

export default TrackLiveEmail;
