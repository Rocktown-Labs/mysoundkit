/* eslint-disable one-var, sort-vars, unicorn/no-await-expression-member */

import {
  allowsMockRealtime,
  buildRealtimeKitMeetingUrl,
  buildRealtimeKitParticipantUrl,
  buildRealtimeMeetingPayload,
  createMockParticipantToken,
  createMockRealtimeMeeting,
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
import type { AppEnv, AuthenticatedUser } from "@/lib/types";

interface CloudflareMeetingResponse {
  data?: {
    id?: string;
    title?: string;
  };
  result?: {
    id?: string;
    title?: string;
  };
  id?: string;
  title?: string;
}

interface CloudflareParticipantResponse {
  data?: {
    id?: string;
    token?: string;
  };
  result?: {
    id?: string;
    token?: string;
  };
  id?: string;
  token?: string;
}

export const realtimeSetupRequired = {
  message:
    "Cloudflare RealtimeKit is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_REALTIMEKIT_APP_ID.",
};

const realtimeKitConfig = (env: AppEnv["Bindings"]) => ({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    allowMockRealtime: env.SOUNDKIT_ALLOW_MOCK_REALTIME,
    apiToken: env.CLOUDFLARE_API_TOKEN,
    appId: env.CLOUDFLARE_REALTIMEKIT_APP_ID,
  }),
  readResponseSnippet = async (response: Response) =>
    (await response.text().catch(() => "")).slice(0, 500),
  logCloudflareApiFailure = async ({
    label,
    response,
  }: {
    label: string;
    response: Response;
  }) => {
    console.error(label, {
      body: await readResponseSnippet(response),
      status: response.status,
      statusText: response.statusText,
    });
  };

export const createRealtimeMeeting = async ({
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
        const data = (await response.json()) as CloudflareMeetingResponse,
          meeting = data.result ?? data.data ?? data,
          meetingId = meeting?.id;

        if (meetingId) {
          return {
            id: meetingId,
            provider: "cloudflare_realtimekit",
            status: "configured",
            title: meeting?.title ?? title,
          };
        }
      }

      await logCloudflareApiFailure({
        label: "Cloudflare RealtimeKit meeting creation failed",
        response,
      });
    } catch (error) {
      console.error("Cloudflare RealtimeKit meeting creation failed", error);
    }
  }

  if (allowsMockRealtime(config)) {
    return createMockRealtimeMeeting({ kind, title });
  }

  throw new Error(realtimeSetupRequired.message);
};

export const createRealtimeParticipant = async ({
  activeArtistUserId,
  env,
  kind,
  meetingId,
  phase,
  role,
  user,
}: {
  activeArtistUserId?: string | null;
  env: AppEnv["Bindings"];
  kind: LiveExperienceKind;
  meetingId: string;
  phase?: BattlePhase;
  role: LiveParticipantRole;
  user: AuthenticatedUser;
}): Promise<RealtimeParticipantToken> => {
  const config = realtimeKitConfig(env),
    presetName = resolveRealtimePreset({
      activeArtistUserId,
      kind,
      phase,
      role,
      userId: user.id,
    });

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
        const data = (await response.json()) as CloudflareParticipantResponse,
          participant = data.result ?? data.data ?? data,
          authToken = participant?.token,
          participantId = participant?.id;

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

      await logCloudflareApiFailure({
        label: "Cloudflare RealtimeKit participant creation failed",
        response,
      });
    } catch (error) {
      console.error(
        "Cloudflare RealtimeKit participant creation failed",
        error
      );
    }
  }

  if (allowsMockRealtime(config)) {
    return createMockParticipantToken({
      activeArtistUserId,
      kind,
      meetingId,
      phase,
      role,
      user,
    });
  }

  throw new Error(realtimeSetupRequired.message);
};
