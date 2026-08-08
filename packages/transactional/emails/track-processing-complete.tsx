import { TrackLifecycleEmail } from "../src/index";
import type { TrackLifecycleEmailProps } from "../src/index";

const TrackProcessingCompleteEmail =
  TrackLifecycleEmail as typeof TrackLifecycleEmail & {
    PreviewProps: TrackLifecycleEmailProps;
  };

TrackProcessingCompleteEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/tracks/demo-track",
  artistName: "MetroFlow",
  assetBaseUrl: "https://mysoundkit.com",
  previewText: "Midnight Bounce finished premium processing on SoundKit.",
  processingComplete: true,
  trackTitle: "Midnight Bounce",
} satisfies TrackLifecycleEmailProps;

export default TrackProcessingCompleteEmail;
