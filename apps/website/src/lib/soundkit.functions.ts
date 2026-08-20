import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { InferResponseType } from "hono/client";
import { z } from "zod";

import {
  credentialsRouteForAccount,
  signupRedirectForUser,
} from "@/lib/onboarding-flow";
import {
  createSoundKitServerClient,
  SoundKitServerError,
  soundkitServerJson,
} from "@/lib/soundkit-client";

const currentCookie = () => getRequestHeader("cookie") ?? null,
  currentClient = () => createSoundKitServerClient(currentCookie()),
  rpcTypeClient = createSoundKitServerClient(null),
  meGet = rpcTypeClient.v1.me.index.$get,
  tracksGet = rpcTypeClient.v1.tracks.index.$get,
  trackGet = rpcTypeClient.v1.tracks[":trackId"].$get,
  onboardingStateGet = rpcTypeClient.v1.onboarding.state.$get;

type MeResponse = InferResponseType<typeof meGet, 200>;
type OnboardingStateResponse = InferResponseType<
  typeof onboardingStateGet,
  200
>;
const accountTypeSchema = z.enum(["artist", "fan"]);
export type DashboardTrackSummary = InferResponseType<
  typeof tracksGet,
  200
>[number];
type TrackDetail = InferResponseType<typeof trackGet, 200>;
type SerializableTrackDetail = Omit<TrackDetail, "assets"> & {
  assets: Omit<TrackDetail["assets"][number], "metadata">[];
};

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const client = currentClient();

  return soundkitServerJson<MeResponse>(await client.v1.me.index.$get());
});

export const requireDashboardUser = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const me = await getMe();

      if (!me.user.onboardingCompletedAt) {
        throw redirect({ to: "/signup" });
      }

      if (me.user.accountType !== "artist" && me.user.role !== "admin") {
        throw redirect({ to: "/library/settings" });
      }

      return me;
    } catch (error) {
      if (error instanceof SoundKitServerError && error.status === 401) {
        throw redirect({
          search: { redirect: "/dashboard" },
          to: "/login",
        });
      }

      throw error;
    }
  }
);

export const redirectAuthedSignupUser = createServerFn({ method: "GET" })
  .validator(z.object({ accountType: accountTypeSchema }))
  .handler(async ({ data }) => {
    let me: MeResponse;

    try {
      me = await getMe();
    } catch (error) {
      if (error instanceof SoundKitServerError && error.status === 401) {
        return { authenticated: false };
      }

      throw error;
    }

    throw redirect({
      to: signupRedirectForUser({
        accountType: data.accountType,
        user: me.user,
      }),
    });
  });

export const requireSignupOnboardingUser = createServerFn({ method: "GET" })
  .validator(z.object({ accountType: accountTypeSchema }))
  .handler(async ({ data }) => {
    try {
      const me = await getMe();
      let onboardingState: OnboardingStateResponse = null;
      try {
        onboardingState = await soundkitServerJson<OnboardingStateResponse>(
          await currentClient().v1.onboarding.state.$get()
        );
      } catch {
        // Older preview API mocks may not expose progress yet. The onboarding
        // submission endpoint remains the authoritative security boundary.
      }

      if (
        data.accountType === "artist" &&
        onboardingState?.creatorEligibility === "major_label_affiliated"
      ) {
        throw redirect({ to: "/signup/fan/onboarding" });
      }

      if (me.user.onboardingCompletedAt) {
        throw redirect({
          to: signupRedirectForUser({
            accountType: data.accountType,
            user: me.user,
          }),
        });
      }

      return me;
    } catch (error) {
      if (error instanceof SoundKitServerError && error.status === 401) {
        throw redirect({ to: credentialsRouteForAccount(data.accountType) });
      }

      throw error;
    }
  });

export const getDashboardTracks = createServerFn({ method: "GET" }).handler(
  async () => {
    const client = currentClient();

    return soundkitServerJson<DashboardTrackSummary[]>(
      await client.v1.tracks.index.$get({ query: {} })
    );
  }
);

export const getTrackDetail = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const client = currentClient(),
      track = await soundkitServerJson<TrackDetail>(
        await client.v1.tracks[":trackId"].$get({
          param: { trackId: data.id },
        })
      );

    return {
      ...track,
      assets: track.assets.map(({ metadata: _metadata, ...asset }) => asset),
    } satisfies SerializableTrackDetail;
  });

export const getPlayerTracks = createServerFn({ method: "GET" }).handler(() =>
  getDashboardTracks()
);
