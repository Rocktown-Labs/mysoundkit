export type ListeningAccess = "public" | "premium_or_purchased";

export type ContentListeningPolicy = {
  exclusiveUntil: Date | string | null | undefined;
  isForSale: boolean;
  listeningAccess: ListeningAccess;
};

export type ContentAccessDecision = {
  canListen: boolean;
  isPreview: boolean;
  reason: "free" | "premium" | "purchased" | "public" | "preview";
};

export const isExclusivityActive = (
  exclusiveUntil: Date | string | null | undefined,
  now = new Date()
): boolean => {
  if (!exclusiveUntil) {
    return false;
  }

  const expiresAt =
    exclusiveUntil instanceof Date ? exclusiveUntil : new Date(exclusiveUntil);

  return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
};

export const resolveListeningAccess = ({
  hasPurchase,
  isPremium,
  now,
  policy,
}: {
  hasPurchase: boolean;
  isPremium: boolean;
  now?: Date;
  policy: ContentListeningPolicy;
}): ContentAccessDecision => {
  if (!policy.isForSale) {
    return { canListen: true, isPreview: false, reason: "free" };
  }

  const protectedByPolicy =
    policy.listeningAccess === "premium_or_purchased" &&
    (!policy.exclusiveUntil || isExclusivityActive(policy.exclusiveUntil, now));

  if (!protectedByPolicy || policy.listeningAccess === "public") {
    return { canListen: true, isPreview: false, reason: "public" };
  }

  if (hasPurchase) {
    return { canListen: true, isPreview: false, reason: "purchased" };
  }

  if (isPremium) {
    return { canListen: true, isPreview: false, reason: "premium" };
  }

  return { canListen: false, isPreview: true, reason: "preview" };
};
