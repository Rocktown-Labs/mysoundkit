/**
 * Real, non-synthetic analytics and monetization domain calculations.
 *
 * Rules:
 * 1. Never fabricate or manufacture metrics when data is unavailable.
 * 2. Normal "Play" counts after >= 30 seconds of playback (or >= 95% for tracks shorter than 30s).
 * 3. Qualified Streams remain the stricter monetization event (70%+ threshold, Premium listener, non-owner).
 * 4. Payout minimum is $25.00 (2500 cents).
 * 5. Minimum location audience threshold is 3 to preserve listener privacy.
 */

export const MIN_LOCATION_LISTENERS = 3;
export const MIN_PAYOUT_THRESHOLD_CENTS = 2500; // $25.00 USD

/**
 * Determines whether a playback session qualifies as a verified 30-second Play.
 */
export const isVerifiedPlay = (
  playedSeconds: number,
  trackDurationSeconds?: number | null
): boolean => {
  if (playedSeconds <= 0) {
    return false;
  }
  // If track is shorter than 30s, require at least 95% playback
  if (
    trackDurationSeconds &&
    trackDurationSeconds > 0 &&
    trackDurationSeconds < 30
  ) {
    return playedSeconds >= trackDurationSeconds * 0.95;
  }
  return playedSeconds >= 30;
};

/**
 * Determines whether a playback session qualifies as a monetization Qualified Stream.
 */
export const isQualifiedStream = ({
  isOwner,
  isPremium,
  playedSeconds,
  trackDurationSeconds,
}: {
  isOwner: boolean;
  isPremium: boolean;
  playedSeconds: number;
  trackDurationSeconds: number;
}): boolean => {
  if (!isPremium || isOwner || trackDurationSeconds <= 0) {
    return false;
  }
  const threshold = trackDurationSeconds * 0.7;
  return playedSeconds >= threshold;
};

export interface RawLocationCount {
  city?: string | null;
  countryCode?: string | null;
  listeners: number;
  regionCode?: string | null;
}

export interface SafeLocationResult {
  hasEnoughData: boolean;
  locations: {
    city: string | null;
    countryCode: string | null;
    listeners: number;
    percentage: number;
    regionCode: string | null;
  }[];
  totalListeners: number;
}

/**
 * Filters geographic locations to protect listener privacy.
 * Cohorts with fewer than MIN_LOCATION_LISTENERS (3) are aggregated into "Other Regions".
 * If total audience is below the threshold, location breakdown is marked unavailable.
 */
export const filterSafeLocations = (
  rawLocations: RawLocationCount[],
  minThreshold = MIN_LOCATION_LISTENERS
): SafeLocationResult => {
  const totalListeners = rawLocations.reduce(
    (sum, loc) => sum + loc.listeners,
    0
  );

  if (totalListeners < minThreshold) {
    return {
      hasEnoughData: false,
      locations: [],
      totalListeners,
    };
  }

  let otherListeners = 0;
  const safeList: SafeLocationResult["locations"] = [];

  for (const loc of rawLocations) {
    if (loc.listeners >= minThreshold) {
      safeList.push({
        city: loc.city ?? null,
        countryCode: loc.countryCode ?? null,
        listeners: loc.listeners,
        percentage:
          totalListeners > 0
            ? Math.round((loc.listeners / totalListeners) * 100)
            : 0,
        regionCode: loc.regionCode ?? null,
      });
    } else {
      otherListeners += loc.listeners;
    }
  }

  if (otherListeners > 0) {
    safeList.push({
      city: "Other Regions",
      countryCode: null,
      listeners: otherListeners,
      percentage:
        totalListeners > 0
          ? Math.round((otherListeners / totalListeners) * 100)
          : 0,
      regionCode: null,
    });
  }

  return {
    hasEnoughData: safeList.length > 0,
    locations: safeList,
    totalListeners,
  };
};

/**
 * Evaluates creator payout eligibility against the $25.00 minimum threshold.
 */
export const computePayoutState = (
  availableBalanceCents: number,
  minThresholdCents = MIN_PAYOUT_THRESHOLD_CENTS
) => {
  const isEligible = availableBalanceCents >= minThresholdCents,
    progressPercent = Math.min(
      100,
      Math.round((availableBalanceCents / minThresholdCents) * 100)
    ),
    remainingCents = Math.max(0, minThresholdCents - availableBalanceCents);

  return {
    isEligible,
    progressPercent,
    remainingCents,
  };
};

/**
 * Calculates returning listener retention rate.
 */
export const computeReturningRate = (
  returningListeners: number,
  totalListeners: number
): number => {
  if (totalListeners <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((returningListeners / totalListeners) * 100));
};
