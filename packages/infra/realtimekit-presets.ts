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

const mediaConfig = {
  audio: { enable_high_bitrate: true, enable_stereo: true },
  screenshare: { frame_rate: 15, quality: "hd" },
  video: { frame_rate: 30, quality: "hd", simulcast: true },
};

const uiConfig = {
  design_tokens: {
    border_radius: "rounded",
    border_width: "thin",
    colors: {
      background: {
        "600": "#171717",
        "700": "#101010",
        "800": "#0a0a0a",
        "900": "#050505",
        "1000": "#000000",
      },
      brand: {
        "300": "#fda4af",
        "400": "#fb7185",
        "500": "#f43f5e",
        "600": "#e11d48",
        "700": "#be123c",
      },
      danger: "#ef4444",
      success: "#22c55e",
      text: "#ffffff",
      text_on_brand: "#ffffff",
      video_bg: "#000000",
      warning: "#f59e0b",
    },
    spacing_base: 4,
    theme: "dark",
  },
};

const basePermissions = {
  accept_waiting_requests: false,
  can_accept_production_requests: false,
  can_change_participant_permissions: false,
  can_livestream: false,
  can_record: false,
  can_spotlight: false,
  chat: {
    private: {
      can_receive: false,
      can_send: false,
      files: false,
      text: false,
    },
    public: {
      can_send: true,
      files: false,
      text: true,
    },
  },
  connected_meetings: {
    can_alter_connected_meetings: false,
    can_switch_connected_meetings: false,
    can_switch_to_parent_meeting: false,
  },
  disable_participant_audio: false,
  disable_participant_screensharing: false,
  disable_participant_video: false,
  hidden_participant: false,
  kick_participant: false,
  media: {
    audio: { can_produce: "NOT_ALLOWED" },
    screenshare: { can_produce: "NOT_ALLOWED" },
    video: { can_produce: "NOT_ALLOWED" },
  },
  pin_participant: false,
  plugins: {
    can_close: false,
    can_edit_config: false,
    can_start: false,
    config: {},
  },
  polls: { can_create: false, can_view: false, can_vote: false },
  recorder_type: "NONE",
  show_participant_list: true,
};

const viewerPermissions = {
  ...basePermissions,
  can_edit_display_name: true,
};

const textOnlyConfig = {
  max_screenshare_count: 0,
  max_video_streams: { desktop: 0, mobile: 0 },
  media: mediaConfig,
  view_type: "GROUP_CALL",
};

const hostConfig = {
  max_screenshare_count: 1,
  max_video_streams: { desktop: 1, mobile: 1 },
  media: mediaConfig,
  view_type: "GROUP_CALL",
};

const hostPermissions = {
  ...basePermissions,
  accept_waiting_requests: true,
  can_edit_display_name: true,
  can_livestream: true,
  can_record: true,
  can_spotlight: true,
  chat: {
    ...basePermissions.chat,
    public: { can_send: true, files: true, text: true },
  },
  kick_participant: true,
  media: {
    audio: { can_produce: "ALLOWED" },
    screenshare: { can_produce: "ALLOWED" },
    video: { can_produce: "ALLOWED" },
  },
  pin_participant: true,
  recorder_type: "RECORDER",
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

  const appList = Array.isArray(apps) ? apps : (apps.apps ?? []);
  const targetAppId = process.env.CLOUDFLARE_REALTIMEKIT_APP_ID;
  const match = targetAppId
    ? appList.find((app) => app.id === targetAppId)
    : appList.find((app) => app.name?.toLowerCase().includes("soundkit"));

  if (!match?.id) {
    throw new Error(
      targetAppId
        ? `RealtimeKit app ${targetAppId} was not found.`
        : "No RealtimeKit app with a SoundKit name was found. Set CLOUDFLARE_REALTIMEKIT_APP_ID to the app id."
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

      await readResponse(
        await api.delete(`${baseUrl}/${existingId}`),
        `Deleting preset ${preset.name}`
      );
      console.log(`Deleted: ${preset.name} (${existingId})`);
      continue;
    }

    if (existingId) {
      if (dryRun) {
        console.log(`UPDATE dry-run: ${preset.name} (${existingId})`);
        continue;
      }

      await readResponse(
        await api.patch(`${baseUrl}/${existingId}`, {
          config: preset.config,
          permissions: preset.permissions,
          ui: uiConfig,
        }),
        `Updating preset ${preset.name}`
      );
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
        ui: uiConfig,
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
