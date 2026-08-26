import { hasCommunitySubscriptionAccess } from "@/lib/community-subscriptions";
import type { CommunitySubscriptionStatus } from "@/lib/community-subscriptions";

interface CommunityAccessSubscription {
  currentPeriodEnd: Date | null;
  status: CommunitySubscriptionStatus;
}

export const hasCommunityAccess = ({
  isBanned,
  isMember,
  isOwner,
  subscriptions,
}: {
  isBanned: boolean;
  isMember: boolean;
  isOwner: boolean;
  subscriptions: CommunityAccessSubscription[];
}) =>
  !isBanned &&
  (isOwner || isMember || subscriptions.some(hasCommunitySubscriptionAccess));
