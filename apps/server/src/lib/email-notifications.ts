export interface EmailNotificationPayload {
  recipientEmail: string;
  recipientName: string;
  type:
    | "battle_challenge"
    | "open_verse_invite"
    | "artist_weekly_summary"
    | "post_battle_summary";
  details: {
    actionUrl?: string;
    artistName?: string;
    battleFormat?: string;
    message?: string;
    openVerseTitle?: string;
    playsCount?: number;
    scores?: string;
    tracklist?: string[];
    winnerName?: string;
  };
}

export function buildNotificationEmailHtml(
  payload: EmailNotificationPayload
): string {
  const { details, recipientName, type } = payload;

  if (type === "battle_challenge") {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #8b5cf6;">Swords Up! New Battle Challenge</h2>
        <p>Hey ${recipientName},</p>
        <p><strong>${details.artistName}</strong> has challenged you to a <strong>${details.battleFormat || "Best of 5"}</strong> battle on SoundKit!</p>
        ${details.message ? `<blockquote style="border-left: 3px solid #8b5cf6; padding-left: 10px; color: #555;">"${details.message}"</blockquote>` : ""}
        <p style="margin-top: 20px;">
          <a href="${details.actionUrl || "https://mysoundkit.com/dashboard/live/challenge"}" style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold;">Respond to Challenge</a>
        </p>
      </div>
    `;
  }

  if (type === "post_battle_summary") {
    const tracksHtml = (details.tracklist || [])
      .map(
        (t, idx) =>
          `<li style="padding: 4px 0;">Round ${idx + 1}: <strong>${t}</strong></li>`
      )
      .join("");

    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #f43f5e; margin-bottom: 4px;">🏆 Battle Recap &amp; Tracklist</h2>
        <p style="color: #6b7280; font-size: 14px; margin-top: 0;">Winner: <strong>${details.winnerName || "MetroFlow"}</strong> (${details.scores || "3 - 2"})</p>
        <p>Hey ${recipientName}, here is the tracklist played during the live battle:</p>
        <ul style="background-color: #f9fafb; padding: 16px 28px; border-radius: 8px; font-size: 14px;">
          ${tracksHtml || "<li>Round 1: Metro Bounce (WAV)</li><li>Round 2: Nightfall Vibe (Master)</li>"}
        </ul>
        <p style="margin-top: 20px;">
          <a href="${details.actionUrl || "https://mysoundkit.com/live/preview"}" style="background-color: #f43f5e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold;">Watch Battle Replay</a>
        </p>
      </div>
    `;
  }

  if (type === "open_verse_invite") {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ec4899;">Private Open Verse Collab Invitation</h2>
        <p>Hey ${recipientName},</p>
        <p><strong>${details.artistName}</strong> invited you to collaborate on their private Open Verse: <strong>"${details.openVerseTitle || "New Track Collab"}"</strong>.</p>
        <p style="margin-top: 20px;">
          <a href="${details.actionUrl || "https://mysoundkit.com/dashboard/open-verses"}" style="background-color: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold;">Join Collaboration</a>
        </p>
      </div>
    `;
  }

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3b82f6;">Your Weekly SoundKit Performance Summary</h2>
      <p>Hey ${recipientName},</p>
      <p>Here is your weekly artist recap:</p>
      <ul>
        <li><strong>Weekly Plays:</strong> ${(details.playsCount || 0).toLocaleString()}</li>
        <li><strong>Active Fans:</strong> Ready to listen</li>
      </ul>
      <p style="margin-top: 20px;">
        <a href="https://mysoundkit.com/dashboard" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold;">Open Dashboard</a>
      </p>
    </div>
  `;
}
