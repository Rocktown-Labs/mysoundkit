import { TrackLifecycleEmail } from "../src/index";
import type { TrackLifecycleEmailProps } from "../src/index";

const TrackLiveEmail = TrackLifecycleEmail as typeof TrackLifecycleEmail & {
  PreviewProps: TrackLifecycleEmailProps;
};

TrackLiveEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/tracks/demo-track",
  artistName: "MetroFlow",
  assetBaseUrl: "https://mysoundkit.com",
  previewText: "Midnight Bounce is live on SoundKit.",
  trackTitle: "Midnight Bounce",
} satisfies TrackLifecycleEmailProps;

export default TrackLiveEmail;
