#!/usr/bin/env node
// Registers a RealtimeKit webhook for a SoundKit live-experience event.
//
// Usage:
//   node scripts/register-realtimekit-webhook.mjs https://soundkit.example.com/v1/webhooks/realtimekit
//
// Env required:
//   CLOUDFLARE_ACCOUNT_ID
//   CLOUDFLARE_API_TOKEN
//   CLOUDFLARE_REALTIMEKIT_APP_ID
//
// Options:
//   --name "Recording webhook"   Webhook label (default: "SoundKit live experiences")
//   --delete                     Unregister the webhook instead of creating it

const args = process.argv.slice(2),
  urlIndex = args.findIndex((arg) => !arg.startsWith("--")),
  webhookUrl = urlIndex === -1 ? null : args[urlIndex],
  options = args.filter((arg) => arg.startsWith("--")),
  deleteMode = options.includes("--delete"),
  nameArgIndex = args.indexOf("--name"),
  name =
    nameArgIndex === -1 ? "SoundKit live experiences" : args[nameArgIndex + 1],
  accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken = process.env.CLOUDFLARE_API_TOKEN,
  configuredAppId = process.env.CLOUDFLARE_REALTIMEKIT_APP_ID,
  events = [
    "meeting.started",
    "meeting.ended",
    "meeting.participantJoined",
    "meeting.participantLeft",
    "recording.statusUpdate",
    "meeting.chatSynced",
  ];

if (!(accountId && apiToken)) {
  console.error(
    "Missing Cloudflare credentials. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN."
  );
  process.exit(1);
}

if (!webhookUrl) {
  console.error(
    "Missing webhook URL. Pass it as the first positional argument."
  );
  process.exit(1);
}

const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  },
  resolveAppId = async () => {
    if (configuredAppId) {
      return configuredAppId;
    }

    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/apps`,
        { headers }
      ),
      body = await response.json();
    if (!response.ok) {
      throw new Error(
        `Unable to discover RealtimeKit apps: ${response.status} ${JSON.stringify(body)}`
      );
    }

    const apps = Array.isArray(body.result)
        ? body.result
        : (body.result?.apps ?? []),
      app = apps.find((entry) =>
        entry.name?.toLowerCase().includes("soundkit")
      );
    if (!app?.id) {
      throw new Error(
        "No RealtimeKit app with a SoundKit name was found. Set CLOUDFLARE_REALTIMEKIT_APP_ID explicitly."
      );
    }

    return app.id;
  },
  listExisting = async (apiUrl) => {
    const response = await fetch(apiUrl, { headers, method: "GET" });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Unable to list webhooks: ${response.status} ${body}`);
    }

    const data = await response.json();

    return (data.result ?? []).filter((entry) => entry.url === webhookUrl);
  },
  main = async () => {
    const appId = await resolveAppId(),
      apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/webhooks`,
      existing = await listExisting(apiUrl),
      [match] = existing;

    if (deleteMode) {
      if (!match?.id) {
        console.log("No matching RealtimeKit webhook to delete.");
        return;
      }

      const response = await fetch(`${apiUrl}/${match.id}`, {
        headers,
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Unable to delete webhook: ${response.status} ${body}`);
      }

      console.log(`Deleted RealtimeKit webhook ${match.id} for ${webhookUrl}`);
      return;
    }

    if (match?.id) {
      const response = await fetch(`${apiUrl}/${match.id}`, {
        body: JSON.stringify({
          enabled: true,
          events,
          name,
          url: webhookUrl,
        }),
        headers,
        method: "PATCH",
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Unable to update webhook: ${response.status} ${body}`);
      }

      console.log(`Updated RealtimeKit webhook ${match.id} for ${webhookUrl}`);
      return;
    }

    const response = await fetch(apiUrl, {
      body: JSON.stringify({
        enabled: true,
        events,
        name,
        url: webhookUrl,
      }),
      headers,
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Unable to create webhook: ${response.status} ${body}`);
    }

    const data = await response.json();
    console.log(
      `Created RealtimeKit webhook ${data.result?.id ?? "?"} for ${webhookUrl}`
    );
  };

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
