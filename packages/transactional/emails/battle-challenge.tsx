import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const BattleChallengeEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

BattleChallengeEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/live/challenge",
  assetBaseUrl: "https://mysoundkit.com",
  body: "MetroFlow challenged you to a best of 5 trap battle. Open the challenge to review the details and respond when you are ready.",
  ctaLabel: "Review challenge",
  eyebrow: "Battle invite",
  footerNote:
    "You are receiving this because collaboration emails are turned on for your SoundKit account.",
  heading: "You have a new battle challenge",
  previewText: "MetroFlow challenged you to a battle on SoundKit.",
  recipientName: "Ava",
} satisfies TransactionalNotificationEmailProps;

export default BattleChallengeEmail;
