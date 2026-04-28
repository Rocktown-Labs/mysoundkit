import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { InferResponseType } from "hono/client";
import { z } from "zod";

import {
  createSoundKitServerClient,
  SoundKitServerError,
  soundkitServerJson,
} from "@/lib/soundkit.server";

const currentCookie = () => getRequestHeader("cookie") ?? null;
const currentClient = () => createSoundKitServerClient(currentCookie());

const rpcTypeClient = createSoundKitServerClient(null);
const meGet = rpcTypeClient.v1.me.index.$get;
const tracksGet = rpcTypeClient.v1.tracks.index.$get;
const trackGet = rpcTypeClient.v1.tracks[":trackId"].$get;

type MeResponse = InferResponseType<typeof meGet, 200>;
export type DashboardTrackSummary = InferResponseType<
  typeof tracksGet,
  200
>[number];
type TrackDetail = InferResponseType<typeof trackGet, 200>;

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

      return me;
    } catch (error) {
      if (error instanceof SoundKitServerError && error.status === 401) {
        throw redirect({ to: "/login" });
      }

      throw error;
    }
  }
);

export const getDashboardTracks = createServerFn({ method: "GET" }).handler(
  async () => {
    const client = currentClient();

    return soundkitServerJson<DashboardTrackSummary[]>(
      await client.v1.tracks.index.$get()
    );
  }
);

export const getTrackDetail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const client = currentClient();

    return soundkitServerJson<TrackDetail>(
      await client.v1.tracks[":trackId"].$get({
        param: { trackId: data.id },
      })
    );
  });

export const getPlayerTracks = createServerFn({ method: "GET" }).handler(() =>
  getDashboardTracks()
);
