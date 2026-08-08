import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const BattleResultsEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

BattleResultsEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/live",
  assetBaseUrl: "https://mysoundkit.com",
  body: "West Coast Showdown is complete. Metro Bounce won 3 to 2. Open the recap to review the rounds, results, and next steps.",
  ctaLabel: "View recap",
  eyebrow: "Battle results",
  footerNote:
    "You are receiving this because collaboration emails are turned on for your SoundKit account.",
  heading: "Your battle results are ready",
  previewText: "West Coast Showdown is complete.",
  recipientName: "MetroFlow",
} satisfies TransactionalNotificationEmailProps;

export default BattleResultsEmail;
