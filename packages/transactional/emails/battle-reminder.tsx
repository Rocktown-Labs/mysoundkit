import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const BattleReminderEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

BattleReminderEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/live",
  assetBaseUrl: "https://mysoundkit.com",
  body: "West Coast Showdown starts soon. Open the room to make sure your tracks, chat, and battle setup are ready before listeners arrive.",
  ctaLabel: "Open battle room",
  eyebrow: "Starts soon",
  footerNote:
    "You are receiving this because collaboration emails are turned on for your SoundKit account.",
  heading: "Your battle is coming up",
  previewText: "West Coast Showdown starts soon.",
  recipientName: "MetroFlow",
} satisfies TransactionalNotificationEmailProps;

export default BattleReminderEmail;
