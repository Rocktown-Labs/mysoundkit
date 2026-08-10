import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const PurchaseReceiptEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

PurchaseReceiptEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/library/purchased/purchase_123",
  assetBaseUrl: "https://mysoundkit.com",
  body: "Your purchase is complete. Midnight Bounce is now in your SoundKit library, and your files are ready when you are.",
  ctaLabel: "Open purchase",
  eyebrow: "Receipt",
  footerNote:
    "You are receiving this because sales emails are turned on for your SoundKit account.",
  heading: "Your purchase is ready",
  previewText: "Your SoundKit purchase is ready.",
  recipientName: "Ava",
} satisfies TransactionalNotificationEmailProps;

export default PurchaseReceiptEmail;
