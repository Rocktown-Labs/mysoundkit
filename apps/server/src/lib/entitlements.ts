import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { planCatalog, subscriptionEntitlements } from "@soundkit/db/schema/app";
import { member, subscription } from "@soundkit/db/schema/auth";
import { and, eq, inArray } from "drizzle-orm";

import type { AppEnv, AuthenticatedSession, AuthenticatedUser } from "./types";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

const ENTITLEMENT_KEYS = {
  canCreateLiveBattles: [
    "can_create_live_battles",
    "live_battles:create",
  ] as const,
  canHostLiveStreams: ["can_host_live_streams", "live_streams:host"] as const,
  canViewLiveBattles: ["can_view_live_battles", "live_battles:view"] as const,
  canVoteLiveBattles: ["can_vote_live_battles", "live_battles:vote"] as const,
  canWatchCreatorStreams: [
    "can_watch_creator_streams",
    "live_streams:view",
  ] as const,
  isPremium: ["is_premium", "premium_access"] as const,
} as const;

const parseBoolean = (value: string | null | undefined): boolean | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "disabled"].includes(normalized)) {
    return false;
  }

  return null;
};

const uniq = <T>(values: T[]) => [...new Set(values)];

const entitlementValue = (
  entitlements: Map<string, string>,
  keys: readonly string[]
): boolean | null => {
  for (const key of keys) {
    const value = parseBoolean(entitlements.get(key));

    if (value !== null) {
      return value;
    }
  }

  return null;
};

export interface EntitlementSnapshot {
  activePlanCode: string | null;
  canCreateLiveBattles: boolean;
  canHostLiveStreams: boolean;
  canViewLiveBattles: boolean;
  canVoteLiveBattles: boolean;
  canWatchCreatorStreams: boolean;
  isPremium: boolean;
  referenceId: string | null;
  status: string | null;
}

const defaultEntitlements = (): EntitlementSnapshot => ({
  activePlanCode: null,
  canCreateLiveBattles: false,
  canHostLiveStreams: false,
  canViewLiveBattles: false,
  canVoteLiveBattles: false,
  canWatchCreatorStreams: false,
  isPremium: false,
  referenceId: null,
  status: null,
});

const compareReferencePriority = (
  candidateReferenceIds: string[],
  left: string,
  right: string
) => {
  const leftIndex = candidateReferenceIds.indexOf(left);
  const rightIndex = candidateReferenceIds.indexOf(right);

  if (leftIndex === rightIndex) {
    return 0;
  }

  if (leftIndex === -1) {
    return 1;
  }

  if (rightIndex === -1) {
    return -1;
  }

  return leftIndex - rightIndex;
};

const compareStatusPriority = (left: string, right: string) => {
  const leftPriority = left === "active" ? 0 : (left === "trialing" ? 1 : 2);
  const rightPriority = right === "active" ? 0 : (right === "trialing" ? 1 : 2);

  return leftPriority - rightPriority;
};

export const resolveEntitlements = async ({
  session,
  user,
}: {
  session: AuthenticatedSession | null;
  user: AuthenticatedUser | null;
}): Promise<EntitlementSnapshot> => {
  if (!user?.id || !isDatabaseConfigured()) {
    return defaultEntitlements();
  }

  const db = createDb();
  const memberships = await db
    .select({
      organizationId: member.organizationId,
    })
    .from(member)
    .where(eq(member.userId, user.id));

  const candidateReferenceIds = uniq(
    [
      session?.activeOrganizationId ?? null,
      user.id,
      ...memberships.map(({ organizationId }) => organizationId),
    ].filter((value): value is string => Boolean(value))
  );

  if (candidateReferenceIds.length === 0) {
    return defaultEntitlements();
  }

  const subscriptions = await db
    .select({
      audience: planCatalog.audience,
      canViewLiveBattles: planCatalog.canViewLiveBattles,
      canVoteLiveBattles: planCatalog.canVoteLiveBattles,
      monthlyPrice: planCatalog.monthlyPrice,
      plan: subscription.plan,
      referenceId: subscription.referenceId,
      status: subscription.status,
      subscriptionId: subscription.id,
    })
    .from(subscription)
    .leftJoin(planCatalog, eq(subscription.plan, planCatalog.code))
    .where(
      and(
        inArray(subscription.referenceId, candidateReferenceIds),
        inArray(subscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES])
      )
    );

  const activeSubscription = subscriptions.toSorted((left, right) => {
    const referencePriority = compareReferencePriority(
      candidateReferenceIds,
      left.referenceId,
      right.referenceId
    );

    if (referencePriority !== 0) {
      return referencePriority;
    }

    return compareStatusPriority(left.status, right.status);
  })[0];

  if (!activeSubscription) {
    return defaultEntitlements();
  }

  const entitlementRows = await db
    .select({
      key: subscriptionEntitlements.entitlementKey,
      value: subscriptionEntitlements.entitlementValue,
    })
    .from(subscriptionEntitlements)
    .where(
      eq(
        subscriptionEntitlements.subscriptionId,
        activeSubscription.subscriptionId
      )
    );

  const entitlementMap = new Map(
    entitlementRows.map(({ key, value }) => [key, value] as const)
  );

  const paidPlan =
    activeSubscription.monthlyPrice !== null &&
    Number(activeSubscription.monthlyPrice) > 0;
  const artistPlan = activeSubscription.audience === "artist";

  const canViewLiveBattles =
    entitlementValue(entitlementMap, ENTITLEMENT_KEYS.canViewLiveBattles) ??
    activeSubscription.canViewLiveBattles ??
    paidPlan;
  const canVoteLiveBattles =
    entitlementValue(entitlementMap, ENTITLEMENT_KEYS.canVoteLiveBattles) ??
    activeSubscription.canVoteLiveBattles ??
    canViewLiveBattles;
  const canHostLiveStreams =
    entitlementValue(entitlementMap, ENTITLEMENT_KEYS.canHostLiveStreams) ??
    (artistPlan && paidPlan);
  const canCreateLiveBattles =
    entitlementValue(entitlementMap, ENTITLEMENT_KEYS.canCreateLiveBattles) ??
    (artistPlan && paidPlan);
  const canWatchCreatorStreams =
    entitlementValue(entitlementMap, ENTITLEMENT_KEYS.canWatchCreatorStreams) ??
    paidPlan;
  const isPremiumOverride = entitlementValue(
    entitlementMap,
    ENTITLEMENT_KEYS.isPremium
  );
  const isPremium =
    isPremiumOverride ??
    (paidPlan ||
      canHostLiveStreams ||
      canCreateLiveBattles ||
      canWatchCreatorStreams);

  return {
    activePlanCode: activeSubscription.plan,
    canCreateLiveBattles,
    canHostLiveStreams,
    canViewLiveBattles,
    canVoteLiveBattles,
    canWatchCreatorStreams,
    isPremium,
    referenceId: activeSubscription.referenceId,
    status: activeSubscription.status,
  };
};

export const isAuthenticatedUser = (
  user: AppEnv["Variables"]["user"]
): user is AuthenticatedUser => Boolean(user?.id);

export const isAuthenticatedSession = (
  session: AppEnv["Variables"]["session"]
): session is AuthenticatedSession => Boolean(session?.id && session?.userId);

export const unauthorizedMessage = {
  message: "Authentication is required.",
} as const;

export const forbiddenMessage = (message: string) => ({ message }) as const;
