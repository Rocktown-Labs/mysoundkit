import { BattleOutcomeEmail } from "../src/index";
import type { BattleOutcomeEmailProps } from "../src/index";

const BattleOutcomePreview = BattleOutcomeEmail as typeof BattleOutcomeEmail & {
  PreviewProps: BattleOutcomeEmailProps;
};

BattleOutcomePreview.PreviewProps = {
  actionUrl: "https://mysoundkit.com/live/battles/battle_123",
  affectedArtistName: "Artist A",
  assetBaseUrl: "https://mysoundkit.com",
  audience: "viewer",
  battleTitle: "Friday Night Smoke",
  kind: "ducked",
  reason: "ducked",
  recipientName: "Ava",
} satisfies BattleOutcomeEmailProps;

export default BattleOutcomePreview;
