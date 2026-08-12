export type ListeningAccess = "public" | "premium_or_purchased";

export interface ContentListeningPolicy {
  exclusiveUntil: Date | string | null | undefined;
  isForSale: boolean;
  listeningAccess: ListeningAccess;
}

export interface ContentDownloadPolicy {
  downloadsAllowed: boolean;
  downloadsRequireFirstPlay: boolean;
  downloadsRequirePurchase: boolean;
  isForSale: boolean;
}

export type ContentDownloadDecision =
  | { allowed: true; reason: "free" | "premium_or_purchased" }
  | {
      allowed: false;
      reason:
        | "first_play_required"
        | "purchase_required"
        | "downloads_disabled";
    };

export interface ContentAccessDecision {
  canListen: boolean;
  isPreview: boolean;
  reason: "free" | "premium" | "purchased" | "public" | "preview";
}

export const resolveDownloadAccess = ({
  hasPlayed,
  hasPurchase,
  isPremium,
  policy,
}: {
  hasPlayed: boolean;
  hasPurchase: boolean;
  isPremium: boolean;
  policy: ContentDownloadPolicy;
}): ContentDownloadDecision => {
  if (!policy.downloadsAllowed) {
    return { allowed: false, reason: "downloads_disabled" };
  }

  if (
    policy.isForSale &&
    policy.downloadsRequirePurchase &&
    !hasPurchase &&
    !isPremium
  ) {
    return { allowed: false, reason: "purchase_required" };
  }

  if (policy.downloadsRequireFirstPlay && !hasPlayed) {
    return { allowed: false, reason: "first_play_required" };
  }

  return {
    allowed: true,
    reason: policy.isForSale ? "premium_or_purchased" : "free",
  };
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
