import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const BillingIssueEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

BillingIssueEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/settings/billing",
  assetBaseUrl: "https://mysoundkit.com",
  body: "We could not complete your latest SoundKit payment. Update your billing details to keep your plan and account access current.",
  ctaLabel: "Update billing",
  eyebrow: "Billing",
  footerNote:
    "You are receiving this because this email is about billing or account access.",
  heading: "Your payment needs attention",
  previewText: "Update your billing details to keep SoundKit current.",
  recipientName: "Ava",
} satisfies TransactionalNotificationEmailProps;

export default BillingIssueEmail;
