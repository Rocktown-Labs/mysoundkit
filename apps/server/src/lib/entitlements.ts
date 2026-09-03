import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { member, subscription } from "@soundkit/db/schema/auth";
import {
  planCatalog,
  subscriptionEntitlements,
} from "@soundkit/db/schema/plans";
import { and, eq, inArray } from "drizzle-orm";

import { CONFIGURED_PAID_PLAN_CODES } from "./plan-codes";
import type { AppEnv, AuthenticatedSession, AuthenticatedUser } from "./types";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]),
  ENTITLEMENT_KEYS = {
    canCreateLiveBattles: [
      "can_create_live_battles",
      "live_battles:create",
    ] as const,
    canHostLiveStreams: ["can_host_live_streams", "live_streams:host"] as const,
    canOperatePaidCommunity: [
      "can_operate_paid_community",
      "communities:operate_paid",
    ] as const,
    canReceivePayouts: ["can_receive_payouts", "payouts:receive"] as const,
    canSellProducts: ["can_sell_products", "products:sell"] as const,
    canViewLiveBattles: ["can_view_live_battles", "live_battles:view"] as const,
    canVoteLiveBattles: ["can_vote_live_battles", "live_battles:vote"] as const,
    canWatchCreatorStreams: [
      "can_watch_creator_streams",
      "live_streams:view",
    ] as const,
    canWatchVod: ["can_watch_vod", "vod:view"] as const,
    isPremium: ["is_premium", "premium_access"] as const,
  } as const,
  parseBoolean = (value: string | null | undefined): boolean | null => {
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
  },
  uniq = <T>(values: T[]) => [...new Set(values)],
  isString = (value: string | null): value is string =>
    typeof value === "string",
  entitlementValue = (
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
  canOperatePaidCommunity: boolean;
  canReceivePayouts: boolean;
  canSellProducts: boolean;
  canViewLiveBattles: boolean;
  canVoteLiveBattles: boolean;
  canWatchCreatorStreams: boolean;
  canWatchVod: boolean;
  isPremium: boolean;
  referenceId: string | null;
  status: string | null;
}

const defaultEntitlements = (): EntitlementSnapshot => ({
    activePlanCode: null,
    canCreateLiveBattles: false,
    canHostLiveStreams: false,
    canOperatePaidCommunity: false,
    canReceivePayouts: false,
    canSellProducts: false,
    canViewLiveBattles: false,
    canVoteLiveBattles: false,
    canWatchCreatorStreams: false,
    canWatchVod: false,
    isPremium: false,
    referenceId: null,
    status: null,
  }),
  compareReferencePriority = (
    candidateReferenceIds: string[],
    left: string,
    right: string
  ) => {
    const leftIndex = candidateReferenceIds.indexOf(left),
      rightIndex = candidateReferenceIds.indexOf(right);

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
  },
  statusPriority = (status: string) => {
    if (status === "active") {
      return 0;
    }

    if (status === "trialing") {
      return 1;
    }

    return 2;
  },
  compareStatusPriority = (left: string, right: string) =>
    statusPriority(left) - statusPriority(right),
  isPaidSubscription = ({
    monthlyPriceCents,
    plan,
  }: {
    monthlyPriceCents: number | null;
    plan: string;
  }) =>
    CONFIGURED_PAID_PLAN_CODES.has(plan) ||
    (monthlyPriceCents !== null && monthlyPriceCents > 0);

// The resolver intentionally combines workspace, subscription, catalog, and override precedence.
// eslint-disable-next-line complexity
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

  const db = createDb(),
    memberships = await db
      .select({
        organizationId: member.organizationId,
      })
      .from(member)
      .where(eq(member.userId, user.id)),
    candidateReferenceIds = uniq(
      [
        session?.activeOrganizationId ?? null,
        user.id,
        ...memberships.map(({ organizationId }) => organizationId),
      ].filter(isString)
    );

  if (candidateReferenceIds.length === 0) {
    return defaultEntitlements();
  }

  const subscriptions = await db
      .select({
        audience: planCatalog.audience,
        monthlyPriceCents: planCatalog.monthlyPriceCents,
        plan: subscription.plan,
        planEntitlements: planCatalog.entitlements,
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
      ),
    [activeSubscription] = subscriptions.toSorted((left, right) => {
      const paidPriority =
        Number(isPaidSubscription(right)) - Number(isPaidSubscription(left));

      if (paidPriority !== 0) {
        return paidPriority;
      }

      const referencePriority = compareReferencePriority(
        candidateReferenceIds,
        left.referenceId,
        right.referenceId
      );

      if (referencePriority !== 0) {
        return referencePriority;
      }

      return compareStatusPriority(left.status, right.status);
    });

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
      ),
    entitlementMap = new Map(
      entitlementRows.map(({ key, value }) => [key, value] as const)
    ),
    paidPlan = isPaidSubscription(activeSubscription),
    artistPlan =
      activeSubscription.audience === "artist" ||
      activeSubscription.plan.startsWith("artist_"),
    catalogEntitlements = new Map(
      Object.entries(activeSubscription.planEntitlements ?? {}).map(
        ([key, value]) => [key, String(value)] as const
      )
    ),
    resolveValue = (keys: readonly string[]) =>
      entitlementValue(entitlementMap, keys) ??
      entitlementValue(catalogEntitlements, keys),
    canViewLiveBattles =
      resolveValue(ENTITLEMENT_KEYS.canViewLiveBattles) ?? paidPlan,
    canVoteLiveBattles =
      resolveValue(ENTITLEMENT_KEYS.canVoteLiveBattles) ?? canViewLiveBattles,
    canHostLiveStreams =
      resolveValue(ENTITLEMENT_KEYS.canHostLiveStreams) ??
      (artistPlan && paidPlan),
    canCreateLiveBattles =
      resolveValue(ENTITLEMENT_KEYS.canCreateLiveBattles) ??
      (artistPlan && paidPlan),
    canWatchCreatorStreams =
      resolveValue(ENTITLEMENT_KEYS.canWatchCreatorStreams) ?? paidPlan,
    canWatchVod = resolveValue(ENTITLEMENT_KEYS.canWatchVod) ?? paidPlan,
    canSellProducts =
      resolveValue(ENTITLEMENT_KEYS.canSellProducts) ??
      (artistPlan && paidPlan),
    canReceivePayouts =
      resolveValue(ENTITLEMENT_KEYS.canReceivePayouts) ??
      (artistPlan && paidPlan),
    canOperatePaidCommunity =
      resolveValue(ENTITLEMENT_KEYS.canOperatePaidCommunity) ??
      (artistPlan && paidPlan),
    isPremiumOverride = resolveValue(ENTITLEMENT_KEYS.isPremium),
    isPremium =
      isPremiumOverride ??
      (paidPlan ||
        canHostLiveStreams ||
        canCreateLiveBattles ||
        canWatchCreatorStreams);

  return {
    activePlanCode: activeSubscription.plan,
    canCreateLiveBattles,
    canHostLiveStreams,
    canOperatePaidCommunity,
    canReceivePayouts,
    canSellProducts,
    canViewLiveBattles,
    canVoteLiveBattles,
    canWatchCreatorStreams,
    canWatchVod,
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
