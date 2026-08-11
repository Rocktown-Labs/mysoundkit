#!/usr/bin/env bun
// Creates or updates the RealtimeKit presets SoundKit expects for live
// experiences (battles, parties, streams).
//
// Uses the Alchemy Cloudflare profile for authentication (see `alchemy
// configure` / `alchemy login`), or a CLOUDFLARE_API_TOKEN in the environment.
// The OAuth profile must include the "Realtime Admin" permission group; if it
// does not, set CLOUDFLARE_API_TOKEN (e.g. the GitHub Actions secret) instead.
//
// Usage:
//   bun realtimekit-presets.ts            # configure presets
//   bun realtimekit-presets.ts --dry-run  # preview without changing anything
//   bun realtimekit-presets.ts --delete   # remove the SoundKit presets
//
// Env (optional):
//   CLOUDFLARE_REALTIMEKIT_APP_ID  Restrict to a specific RealtimeKit app.
//                                  Defaults to the first "soundkit" app found.
//   CLOUDFLARE_PROFILE             Alchemy profile to use (default: "default")

import { createCloudflareApi } from "alchemy/cloudflare";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const deleteMode = args.includes("--delete");

const viewerPermissions = {
  can_edit_display_name: true,
  chat: {
    public: {
      can_send: true,
      files: false,
      text: true,
    },
  },
  media: {
    audio: { can_produce: "NOT_ALLOWED" },
    screenshare: { can_produce: "NOT_ALLOWED" },
    video: { can_produce: "NOT_ALLOWED" },
  },
  show_participant_list: true,
};

const textOnlyConfig = {
  max_screenshare_count: 0,
  max_video_streams: { desktop: 0, mobile: 0 },
  view_type: "GROUP_CALL",
};

const hostConfig = {
  max_screenshare_count: 1,
  max_video_streams: { desktop: 1, mobile: 1 },
  media: { video: { frame_rate: 30, quality: "hd" } },
  view_type: "GROUP_CALL",
};

const hostPermissions = {
  accept_waiting_requests: true,
  can_edit_display_name: true,
  chat: {
    public: {
      can_send: true,
      files: true,
      text: true,
    },
  },
  kick_participant: true,
  media: {
    audio: { can_produce: "ALLOWED" },
    screenshare: { can_produce: "ALLOWED" },
    video: { can_produce: "ALLOWED" },
  },
  show_participant_list: true,
};

const presets = [
  {
    name: "soundkit-battle-lobby-text",
    config: textOnlyConfig,
    permissions: {
      ...viewerPermissions,
      accept_waiting_requests: true,
      waiting_room_type: "SKIP",
    },
  },
  {
    name: "soundkit-battle-artist-live",
    config: hostConfig,
    permissions: {
      ...hostPermissions,
      waiting_room_type: "SKIP",
    },
  },
  {
    name: "soundkit-battle-artist-muted",
    config: textOnlyConfig,
    permissions: {
      ...hostPermissions,
      media: {
        audio: { can_produce: "NOT_ALLOWED" },
        screenshare: { can_produce: "NOT_ALLOWED" },
        video: { can_produce: "NOT_ALLOWED" },
      },
      waiting_room_type: "SKIP",
    },
  },
  {
    name: "soundkit-battle-voter",
    config: textOnlyConfig,
    permissions: {
      ...viewerPermissions,
      polls: { can_create: false, can_view: true, can_vote: true },
      waiting_room_type: "SKIP_ON_ACCEPT",
    },
  },
  {
    name: "soundkit-party-host",
    config: hostConfig,
    permissions: {
      ...hostPermissions,
      waiting_room_type: "SKIP",
    },
  },
  {
    name: "soundkit-party-listener",
    config: textOnlyConfig,
    permissions: {
      ...viewerPermissions,
      waiting_room_type: "SKIP",
    },
  },
  {
    name: "soundkit-stream-host",
    config: hostConfig,
    permissions: {
      ...hostPermissions,
      waiting_room_type: "SKIP",
    },
  },
  {
    name: "soundkit-stream-viewer",
    config: textOnlyConfig,
    permissions: {
      ...viewerPermissions,
      waiting_room_type: "SKIP",
    },
  },
];

const readResponse = async (response, label) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `${label} failed: ${response.status} ${JSON.stringify(
        data.errors ?? data
      )}`
    );
  }

  return data.data ?? data.result ?? data;
};

const main = async () => {
  const api = await createCloudflareApi();
  const apps = await readResponse(
    await api.get(`/accounts/${api.accountId}/realtime/kit/apps`),
    "Listing RealtimeKit apps"
  );

  const appList = Array.isArray(apps) ? apps : apps.apps ?? [];
  const targetAppId = process.env.CLOUDFLARE_REALTIMEKIT_APP_ID;
  const match =
    (targetAppId && appList.find((app) => app.id === targetAppId)) ||
    appList.find((app) => app.name?.toLowerCase().includes("soundkit")) ||
    appList[0];

  if (!match?.id) {
    throw new Error(
      "No RealtimeKit app found. Set CLOUDFLARE_REALTIMEKIT_APP_ID to the app id."
    );
  }

  console.log(`Using RealtimeKit app "${match.name}" (${match.id})`);

  const baseUrl = `/accounts/${api.accountId}/realtime/kit/${match.id}/presets`;
  const existing = await readResponse(
    await api.get(baseUrl),
    "Listing RealtimeKit presets"
  );
  const byName = new Map(
    (Array.isArray(existing) ? existing : []).map((preset) => [
      preset.name,
      preset.id,
    ])
  );

  for (const preset of presets) {
    const existingId = byName.get(preset.name);

    if (deleteMode) {
      if (!existingId) {
        console.log(`DELETE skip (not present): ${preset.name}`);
        continue;
      }

      if (dryRun) {
        console.log(`DELETE dry-run: ${preset.name} (${existingId})`);
        continue;
      }

      await api.delete(`${baseUrl}/${existingId}`);
      console.log(`Deleted: ${preset.name} (${existingId})`);
      continue;
    }

    if (existingId) {
      if (dryRun) {
        console.log(`UPDATE dry-run: ${preset.name} (${existingId})`);
        continue;
      }

      await api.patch(`${baseUrl}/${existingId}`, {
        config: preset.config,
        permissions: preset.permissions,
      });
      console.log(`Updated: ${preset.name} (${existingId})`);
      continue;
    }

    if (dryRun) {
      console.log(`CREATE dry-run: ${preset.name}`);
      continue;
    }

    const created = await readResponse(
      await api.post(baseUrl, {
        config: preset.config,
        name: preset.name,
        permissions: preset.permissions,
      }),
      `Creating preset ${preset.name}`
    );
    console.log(`Created: ${preset.name} (${created?.id ?? "?"})`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
