export type CommunitySubscriptionStatus =
  | "active"
  | "canceled"
  | "expired"
  | "past_due"
  | "pending";

export const hasCommunitySubscriptionAccess = ({
  currentPeriodEnd,
  now = new Date(),
  status,
}: {
  currentPeriodEnd: Date | null;
  now?: Date;
  status: CommunitySubscriptionStatus;
}) =>
  status === "active" ||
  (status === "canceled" &&
    currentPeriodEnd !== null &&
    currentPeriodEnd > now);

export const resolveCommunitySubscriptionStatus = ({
  currentPeriodEndSeconds,
  eventType,
  now = new Date(),
  stripeStatus,
}: {
  currentPeriodEndSeconds?: number;
  eventType: string;
  now?: Date;
  stripeStatus?: string;
}): CommunitySubscriptionStatus => {
  if (eventType === "customer.subscription.deleted") {
    const hasPaidTimeRemaining =
      currentPeriodEndSeconds !== undefined &&
      new Date(currentPeriodEndSeconds * 1000) > now;
    return hasPaidTimeRemaining ? "canceled" : "expired";
  }

  if (stripeStatus === "active" || stripeStatus === "trialing") {
    return "active";
  }

  if (stripeStatus === "past_due") {
    return "past_due";
  }

  return "canceled";
};
