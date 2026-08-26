import { describe, expect, it } from "vitest";

import {
  canManageVideo,
  filterSafeVideoLocations,
  MIN_VIDEO_LOCATION_VIEWERS,
  videoLocationLabel,
} from "./video-analytics";

describe("video analytics access", () => {
  it("allows the owner or active workspace member", () => {
    expect(
      canManageVideo({
        activeOrganizationId: null,
        organizationId: null,
        ownerUserId: "artist-1",
        userId: "artist-1",
      })
    ).toBe(true);
    expect(
      canManageVideo({
        activeOrganizationId: "workspace-1",
        organizationId: "workspace-1",
        ownerUserId: "artist-2",
        userId: "artist-1",
      })
    ).toBe(true);
    expect(
      canManageVideo({
        activeOrganizationId: "workspace-2",
        organizationId: "workspace-1",
        ownerUserId: "artist-2",
        userId: "artist-1",
      })
    ).toBe(false);
  });
});

describe("video analytics geography", () => {
  it("formats premium regional locations with a country", () => {
    expect(
      videoLocationLabel({
        countryCode: "US",
        regionCode: "AR",
        regionName: "Arkansas",
        viewers: 3,
      })
    ).toBe("Arkansas, USA");
  });

  it("keeps free analytics at country level", () => {
    const result = filterSafeVideoLocations(
      [
        {
          countryCode: "US",
          regionCode: "AR",
          regionName: "Arkansas",
          viewers: MIN_VIDEO_LOCATION_VIEWERS,
        },
      ],
      MIN_VIDEO_LOCATION_VIEWERS,
      "country"
    );

    expect(result).toEqual({
      hasEnoughData: true,
      locations: [
        {
          countryCode: "US",
          label: "USA",
          percentage: 100,
          regionCode: null,
          regionName: null,
          viewers: 3,
        },
      ],
    });
  });

  it("aggregates small regional cohorts instead of exposing them", () => {
    const result = filterSafeVideoLocations(
      [
        {
          countryCode: "US",
          regionCode: "AR",
          regionName: "Arkansas",
          viewers: 3,
        },
        {
          countryCode: "US",
          regionCode: "TX",
          regionName: "Texas",
          viewers: 2,
        },
      ],
      5,
      "region"
    );

    expect(result.locations).toEqual([
      {
        countryCode: "US",
        label: "Arkansas, USA",
        percentage: 60,
        regionCode: "AR",
        regionName: "Arkansas",
        viewers: 3,
      },
      {
        countryCode: null,
        label: "Other regions",
        percentage: 40,
        regionCode: null,
        regionName: null,
        viewers: 2,
      },
    ]);
  });

  it("withholds all geography when the audience is too small", () => {
    expect(
      filterSafeVideoLocations(
        [
          {
            countryCode: "US",
            regionCode: "AR",
            regionName: "Arkansas",
            viewers: 2,
          },
        ],
        2,
        "region"
      )
    ).toEqual({ hasEnoughData: false, locations: [] });
  });
});
