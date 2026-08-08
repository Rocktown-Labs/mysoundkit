import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const OpenVerseAcceptedEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

OpenVerseAcceptedEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/open-verses",
  assetBaseUrl: "https://mysoundkit.com",
  body: "Your verse for Midnight Bounce was accepted. You have been added to the track credits so the artist can keep building from there.",
  ctaLabel: "Open collaboration",
  eyebrow: "Verse accepted",
  footerNote:
    "You are receiving this because collaboration emails are turned on for your SoundKit account.",
  heading: "Your open verse was accepted",
  previewText: "Your verse for Midnight Bounce was accepted.",
  recipientName: "Ava",
} satisfies TransactionalNotificationEmailProps;

export default OpenVerseAcceptedEmail;
