import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const OpenVerseSubmittedEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

OpenVerseSubmittedEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/open-verses",
  assetBaseUrl: "https://mysoundkit.com",
  body: "Ava submitted a verse for Midnight Bounce. Open the submission to listen, review the message, and decide whether it fits the track.",
  ctaLabel: "Review submission",
  eyebrow: "Open verse",
  footerNote:
    "You are receiving this because collaboration emails are turned on for your SoundKit account.",
  heading: "You have a new open verse submission",
  previewText: "Ava submitted a verse for Midnight Bounce.",
  recipientName: "MetroFlow",
} satisfies TransactionalNotificationEmailProps;

export default OpenVerseSubmittedEmail;
