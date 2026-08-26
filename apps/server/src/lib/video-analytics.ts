/* eslint-disable one-var */

export const MIN_VIDEO_VIEW_SECONDS = 3;
export const MIN_VIDEO_LOCATION_VIEWERS = 3;

export interface VideoAnalyticsLocationInput {
  countryCode: string | null;
  regionCode: string | null;
  regionName: string | null;
  viewers: number;
}

export interface SafeVideoLocation {
  countryCode: string | null;
  label: string;
  percentage: number;
  regionCode: string | null;
  regionName: string | null;
  viewers: number;
}

export const canManageVideo = ({
  activeOrganizationId,
  organizationId,
  ownerUserId,
  userId,
}: {
  activeOrganizationId: string | null;
  organizationId: string | null;
  ownerUserId: string;
  userId: string;
}) =>
  ownerUserId === userId ||
  Boolean(activeOrganizationId && organizationId === activeOrganizationId);

const countryLabel = (countryCode: string | null) => {
  if (!countryCode) {
    return "Unknown location";
  }

  if (countryCode.toUpperCase() === "US") {
    return "USA";
  }

  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ??
      countryCode
    );
  } catch {
    return countryCode;
  }
};

export const videoLocationLabel = ({
  countryCode,
  regionName,
  regionCode,
}: VideoAnalyticsLocationInput): string => {
  const country = countryLabel(countryCode);
  if (!(regionName || regionCode)) {
    return country;
  }

  return `${regionName ?? regionCode}, ${country}`;
};

export const filterSafeVideoLocations = (
  locations: VideoAnalyticsLocationInput[],
  totalViewers: number,
  level: "country" | "region",
  minThreshold = MIN_VIDEO_LOCATION_VIEWERS
): {
  hasEnoughData: boolean;
  locations: SafeVideoLocation[];
} => {
  if (totalViewers < minThreshold) {
    return { hasEnoughData: false, locations: [] };
  }

  let otherViewers = 0;
  const safeLocations: SafeVideoLocation[] = [];

  for (const location of locations) {
    if (location.viewers >= minThreshold) {
      safeLocations.push({
        countryCode: location.countryCode,
        label:
          level === "region"
            ? videoLocationLabel(location)
            : countryLabel(location.countryCode),
        percentage:
          totalViewers > 0
            ? Math.round((location.viewers / totalViewers) * 100)
            : 0,
        regionCode: level === "region" ? location.regionCode : null,
        regionName: level === "region" ? location.regionName : null,
        viewers: location.viewers,
      });
    } else {
      otherViewers += location.viewers;
    }
  }

  if (otherViewers > 0) {
    safeLocations.push({
      countryCode: null,
      label: level === "region" ? "Other regions" : "Other countries",
      percentage:
        totalViewers > 0 ? Math.round((otherViewers / totalViewers) * 100) : 0,
      regionCode: null,
      regionName: null,
      viewers: otherViewers,
    });
  }

  return {
    hasEnoughData: safeLocations.length > 0,
    locations: safeLocations,
  };
};
