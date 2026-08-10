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

const args = process.argv.slice(2);
const urlIndex = args.findIndex((arg) => !arg.startsWith("--"));
const webhookUrl = urlIndex >= 0 ? args[urlIndex] : null;
const options = args.filter((arg) => arg.startsWith("--"));
const deleteMode = options.includes("--delete");

const nameArgIndex = args.indexOf("--name");
const name =
  nameArgIndex >= 0 ? args[nameArgIndex + 1] : "SoundKit live experiences";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const appId = process.env.CLOUDFLARE_REALTIMEKIT_APP_ID;

const events = [
  "meeting.started",
  "meeting.ended",
  "meeting.participantJoined",
  "meeting.participantLeft",
  "recording.statusUpdate",
  "meeting.chatSynced",
];

if (!(accountId && apiToken && appId)) {
  console.error(
    "Missing Cloudflare credentials. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_REALTIMEKIT_APP_ID."
  );
  process.exit(1);
}

if (!webhookUrl) {
  console.error("Missing webhook URL. Pass it as the first positional argument.");
  process.exit(1);
}

const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/webhooks`;

const headers = {
  Authorization: `Bearer ${apiToken}`,
  "Content-Type": "application/json",
};

const listExisting = async () => {
  const response = await fetch(apiUrl, { headers, method: "GET" });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to list webhooks: ${response.status} ${body}`);
  }

  const data = await response.json();

  return (data.result ?? []).filter((entry) => entry.url === webhookUrl);
};

const main = async () => {
  const existing = await listExisting();
  const [match] = existing;

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
      method: "PUT",
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
