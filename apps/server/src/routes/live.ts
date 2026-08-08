import { Hono } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";

import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import {
  allowsMockRealtime,
  buildNotificationFanout,
  buildRealtimeKitMeetingUrl,
  buildRealtimeKitParticipantUrl,
  buildRealtimeMeetingPayload,
  createMockParticipantToken,
  createMockRealtimeMeeting,
  createRoundVoterSnapshot,
  findLiveSessionConflict,
  hasRealtimeKitConfig,
  resolveRealtimePreset,
} from "@/lib/live-experience";
import type {
  BattlePhase,
  LiveExperienceKind,
  LiveParticipantRole,
  RealtimeMeeting,
  RealtimeParticipantToken,
} from "@/lib/live-experience";
import {
  battleBotActionBodySchema,
  createLiveExperienceBodySchema,
  joinLiveExperienceBodySchema,
  liveSessionLockCheckBodySchema,
} from "@/lib/schemas";
import type { AppEnv, AuthenticatedUser } from "@/lib/types";

const app = new Hono<AppEnv>();

interface CloudflareMeetingResponse {
  data?: {
    id?: string;
    title?: string;
  };
  success?: boolean;
}

interface CloudflareParticipantResponse {
  data?: {
    id?: string;
    token?: string;
  };
  success?: boolean;
}

interface CloudflareStreamResponse {
  result?: {
    playback?: {
      hls?: string;
    };
    rtmps?: {
      streamKey?: string;
      url?: string;
    };
    srt?: {
      streamKey?: string;
      url?: string;
    };
    status?: string;
    uid?: string;
  };
  success?: boolean;
}

const badRequest = (message: string) => ({
  message,
});

const streamInputFromCloudflareResponse = (
  data: CloudflareStreamResponse,
  title?: string
) => {
  const { result } = data;

  if (!(result?.uid && result.rtmps?.streamKey && result.rtmps.url)) {
    return null;
  }

  return {
    id: result.uid,
    playbackUrl: result.playback?.hls ?? "",
    rtmpsKey: result.rtmps.streamKey,
    rtmpsUrl: result.rtmps.url,
    srtKey: result.srt?.streamKey ?? "",
    srtUrl: result.srt?.url ?? "",
    status: result.status ?? "idle",
    ...(title ? { title } : {}),
  };
};

const cloudflareStreamSetupRequired = {
  message:
    "Cloudflare Stream live inputs are not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
};

const createCloudflareStreamInput = async ({
  env,
  title,
}: {
  env: AppEnv["Bindings"];
  title: string;
}) => {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;

  if (!(accountId && apiToken)) {
    return null;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      body: JSON.stringify({
        meta: { name: title },
        recording: { mode: "automatic" },
      }),
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as CloudflareStreamResponse;
  return streamInputFromCloudflareResponse(data, title);
};

const liveKindFromExperienceId = (experienceId: string): LiveExperienceKind => {
  if (experienceId.includes("_party_")) {
    return "party";
  }

  if (experienceId.includes("_stream_")) {
    return "stream";
  }

  return "battle";
};

const defaultSourceForKind = (kind: LiveExperienceKind) => {
  if (kind === "party") {
    return "playlist";
  }

  return "browser";
};

const nextBattlePhaseForAction = ({
  action,
  phase,
}: {
  action: string;
  phase?: BattlePhase;
}) => {
  if (action === "move_lobby_to_round") {
    return "round_active";
  }

  return phase ?? "between_rounds";
};

const realtimeKitConfig = (env: AppEnv["Bindings"]) => ({
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  allowMockRealtime: env.SOUNDKIT_ALLOW_MOCK_REALTIME,
  apiToken: env.CLOUDFLARE_API_TOKEN,
  appId: env.CLOUDFLARE_REALTIMEKIT_APP_ID,
});

const realtimeSetupRequired = {
  message:
    "Cloudflare RealtimeKit is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_REALTIMEKIT_APP_ID.",
};

const createRealtimeMeeting = async ({
  env,
  kind,
  title,
}: {
  env: AppEnv["Bindings"];
  kind: LiveExperienceKind;
  title: string;
}): Promise<RealtimeMeeting> => {
  const config = realtimeKitConfig(env);

  if (
    hasRealtimeKitConfig(config) &&
    config.accountId &&
    config.apiToken &&
    config.appId
  ) {
    try {
      const response = await fetch(
        buildRealtimeKitMeetingUrl({
          accountId: config.accountId,
          appId: config.appId,
        }),
        {
          body: JSON.stringify(buildRealtimeMeetingPayload({ title })),
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as CloudflareMeetingResponse;
        const meetingId = data.data?.id;

        if (meetingId) {
          return {
            id: meetingId,
            provider: "cloudflare_realtimekit",
            status: "configured",
            title: data.data?.title ?? title,
          };
        }
      }
    } catch (error) {
      console.error("Cloudflare RealtimeKit meeting creation failed", error);
    }
  }

  if (allowsMockRealtime(config)) {
    return createMockRealtimeMeeting({ kind, title });
  }

  throw new Error(realtimeSetupRequired.message);
};

const createRealtimeParticipant = async ({
  env,
  kind,
  meetingId,
  phase,
  role,
  user,
}: {
  env: AppEnv["Bindings"];
  kind: LiveExperienceKind;
  meetingId: string;
  phase?: BattlePhase;
  role: LiveParticipantRole;
  user: AuthenticatedUser;
}): Promise<RealtimeParticipantToken> => {
  const config = realtimeKitConfig(env);
  const presetName = resolveRealtimePreset({ kind, phase, role });

  if (
    hasRealtimeKitConfig(config) &&
    config.accountId &&
    config.apiToken &&
    config.appId
  ) {
    try {
      const response = await fetch(
        buildRealtimeKitParticipantUrl({
          accountId: config.accountId,
          appId: config.appId,
          meetingId,
        }),
        {
          body: JSON.stringify({
            custom_participant_id: user.id,
            name: user.name ?? user.email ?? "SoundKit User",
            preset_name: presetName,
          }),
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as CloudflareParticipantResponse;
        const authToken = data.data?.token;
        const participantId = data.data?.id;

        if (authToken && participantId) {
          return {
            authToken,
            breakoutRoomId:
              phase === "lobby" ? `${meetingId}_lobby` : undefined,
            meetingId,
            participantId,
            presetName,
          };
        }
      }
    } catch (error) {
      console.error(
        "Cloudflare RealtimeKit participant creation failed",
        error
      );
    }
  }

  if (allowsMockRealtime(config)) {
    return createMockParticipantToken({
      kind,
      meetingId,
      phase,
      role,
      user,
    });
  }

  throw new Error(realtimeSetupRequired.message);
};

const durableRequest = (
  c: { env: AppEnv["Bindings"] },
  roomId: string,
  path: string,
  init?: RequestInit
) => {
  if (!c.env.LIVE_ROOMS) {
    return null;
  }

  const id = c.env.LIVE_ROOMS.idFromName(roomId);
  const stub = c.env.LIVE_ROOMS.get(id);
  const headers = new Headers(init?.headers);
  headers.set("x-soundkit-live-room-id", roomId);

  return stub.fetch(`https://live-room.soundkit.internal${path}`, {
    ...init,
    headers,
  });
};

app.post("/experiences", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parseResult = createLiveExperienceBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return c.json(
      badRequest("Live experience details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const body = parseResult.data;
  const startsAt = body.scheduledStartAt ?? new Date().toISOString();
  let streamInput = null;

  if (body.kind === "stream" && body.source === "obs") {
    try {
      streamInput = await createCloudflareStreamInput({
        env: c.env,
        title: body.title.trim(),
      });
    } catch (error) {
      console.error("Cloudflare Stream live input creation failed", error);
    }

    if (!streamInput) {
      return c.json(
        cloudflareStreamSetupRequired,
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }
  }

  let meeting: RealtimeMeeting;

  try {
    meeting = await createRealtimeMeeting({
      env: c.env,
      kind: body.kind,
      title: body.title.trim(),
    });
  } catch (error) {
    if (streamInput) {
      meeting = createMockRealtimeMeeting({
        kind: body.kind,
        title: body.title.trim(),
      });
    } else {
      console.error("Unable to create live experience meeting", error);
      return c.json(realtimeSetupRequired, HttpStatusCodes.SERVICE_UNAVAILABLE);
    }
  }

  const experienceId = `live_${body.kind}_${crypto.randomUUID()}`;
  const roomHref = `/live/${
    body.kind === "party" ? "parties" : `${body.kind}s`
  }/${experienceId}`;

  return c.json(
    {
      defaults: {
        captions: true,
        chat: true,
        recording: true,
        setupScreen: true,
      },
      experience: {
        battleKitId: body.battleKitId ?? null,
        createdByUserId: user.id,
        description: body.description ?? "",
        format: body.format ?? null,
        genre: body.genre ?? null,
        id: experienceId,
        kind: body.kind,
        opponentUsername: body.opponentUsername ?? null,
        playlistId: body.playlistId ?? null,
        projectId: body.projectId ?? null,
        roomHref,
        scheduleMode: body.scheduleMode,
        source: body.source ?? defaultSourceForKind(body.kind),
        startsAt,
        status: body.scheduleMode === "asap" ? "ready" : "scheduled",
        title: body.title.trim(),
        visibility: body.visibility,
      },
      lock: {
        experienceId,
        kind: body.kind,
        startsAt,
        status: body.scheduleMode === "asap" ? "live" : "scheduled",
      },
      notifications: buildNotificationFanout({
        experienceId,
        kind: body.kind,
        title: body.title.trim(),
      }),
      realtime: meeting,
      streamInput,
    },
    HttpStatusCodes.CREATED
  );
});

app.post("/experiences/:experienceId/join", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parseResult = joinLiveExperienceBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return c.json(
      badRequest("Live participant details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const experienceId = c.req.param("experienceId");
  const kind = liveKindFromExperienceId(experienceId);
  let participant: RealtimeParticipantToken;

  try {
    participant = await createRealtimeParticipant({
      env: c.env,
      kind,
      meetingId: experienceId,
      phase: parseResult.data.phase,
      role: parseResult.data.role,
      user,
    });
  } catch (error) {
    console.error("Unable to create live participant token", error);
    return c.json(realtimeSetupRequired, HttpStatusCodes.SERVICE_UNAVAILABLE);
  }

  return c.json(
    {
      participant,
      setupScreen: true,
    },
    HttpStatusCodes.CREATED
  );
});

app.post("/experiences/:experienceId/session-locks/check", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parseResult = liveSessionLockCheckBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return c.json(
      badRequest("Live session lock details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const conflict = findLiveSessionConflict(parseResult.data);

  return c.json(
    {
      conflict,
      hasConflict: Boolean(conflict),
    },
    HttpStatusCodes.OK
  );
});

app.post("/experiences/:experienceId/battlebot", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parseResult = battleBotActionBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return c.json(
      badRequest("BattleBot action details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const snapshot = createRoundVoterSnapshot(parseResult.data.participants);

  return c.json(
    {
      action: parseResult.data.action,
      battleBot: {
        message:
          "BattleBot recorded the room action and prepared the next transition.",
        nextPhase: nextBattlePhaseForAction(parseResult.data),
      },
      experienceId: c.req.param("experienceId"),
      snapshot,
    },
    HttpStatusCodes.CREATED
  );
});

app.get("/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const response = await durableRequest(c, roomId, "/state");

  if (!response) {
    return c.json(
      { message: "Live room Durable Object binding is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const room = await response.json();
  return c.json(room, HttpStatusCodes.OK);
});

app.get("/rooms/:roomId/ws", async (c) => {
  const roomId = c.req.param("roomId");
  const response = await durableRequest(c, roomId, "/ws", {
    headers: c.req.raw.headers,
    method: "GET",
  });

  if (!response) {
    return c.json(
      { message: "Live room WebSocket binding is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return response;
});

app.post("/rooms/:roomId/chat", async (c) => {
  const roomId = c.req.param("roomId");
  const body = (await c.req.json().catch(() => ({}))) as {
    message?: string;
    userName?: string;
  };
  const response = await durableRequest(c, roomId, "/chat", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response) {
    return c.json(
      { message: "Live room chat is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const room = await response.json();
  return c.json(room, HttpStatusCodes.CREATED);
});

app.post("/rooms/:roomId/vote", async (c) => {
  const roomId = c.req.param("roomId");
  const response = await durableRequest(c, roomId, "/vote", {
    body: JSON.stringify(await c.req.json().catch(() => ({}))),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response) {
    return c.json(
      { message: "Live room voting is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const voteBody = await response.json();
  return Response.json(voteBody, {
    status: response.status,
  });
});

app.post("/cloudflare-stream", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const title = body.title || "Live Stream";

  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    try {
      const streamInput = await createCloudflareStreamInput({
        env: c.env,
        title,
      });

      if (streamInput) {
        return c.json(streamInput, HttpStatusCodes.CREATED);
      }
    } catch (error) {
      console.error("Cloudflare Stream live input creation failed", error);
    }
  }

  return c.json(
    cloudflareStreamSetupRequired,
    HttpStatusCodes.SERVICE_UNAVAILABLE
  );
});

app.get("/cloudflare-stream/:streamId", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const streamId = c.req.param("streamId");
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${streamId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          method: "GET",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as CloudflareStreamResponse;
        const streamInput = streamInputFromCloudflareResponse(data);

        if (streamInput) {
          return c.json(streamInput, HttpStatusCodes.OK);
        }
      }
    } catch (error) {
      console.error("Cloudflare Stream live input lookup failed", error);
    }
  }

  return c.json(
    {
      message: cloudflareStreamSetupRequired.message,
    },
    HttpStatusCodes.SERVICE_UNAVAILABLE
  );
});

export default app;
