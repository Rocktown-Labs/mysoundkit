import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const SaleNotificationEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

SaleNotificationEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/career/payments",
  assetBaseUrl: "https://mysoundkit.com",
  body: "Ava bought Midnight Bounce for $9.99. Open your dashboard to review the order and keep an eye on your sales activity.",
  ctaLabel: "View sale",
  eyebrow: "New sale",
  footerNote:
    "You are receiving this because sales emails are turned on for your SoundKit account.",
  heading: "You made a sale",
  previewText: "Ava bought Midnight Bounce.",
  recipientName: "MetroFlow",
} satisfies TransactionalNotificationEmailProps;

export default SaleNotificationEmail;
