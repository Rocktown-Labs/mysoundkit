import { describe, expect, it } from "vitest";

import { buildNotificationEmailHtml } from "./email-notifications";

describe("Email Notifications & Summary Templates", () => {
  it("builds battle challenge email HTML", () => {
    const html = buildNotificationEmailHtml({
      details: {
        artistName: "Metro Flow",
        battleFormat: "Best of 5",
        message: "Let's battle!",
      },
      recipientEmail: "opponent@example.com",
      recipientName: "DJ Nova",
      type: "battle_challenge",
    });

    expect(html).toContain("Swords Up! New Battle Challenge");
    expect(html).toContain("Metro Flow");
    expect(html).toContain("Best of 5");
    expect(html).toContain("Let's battle!");
  });

  it("builds private open verse collab email HTML", () => {
    const html = buildNotificationEmailHtml({
      details: {
        artistName: "Neon Pulse",
        openVerseTitle: "Midnight Stems",
      },
      recipientEmail: "collab@example.com",
      recipientName: "Luna Eclipse",
      type: "open_verse_invite",
    });

    expect(html).toContain("Private Open Verse Collab Invitation");
    expect(html).toContain("Midnight Stems");
  });

  it("builds weekly artist summary email HTML", () => {
    const html = buildNotificationEmailHtml({
      details: {
        playsCount: 12_500,
      },
      recipientEmail: "artist@example.com",
      recipientName: "Street Poet",
      type: "artist_weekly_summary",
    });

    expect(html).toContain("Your Weekly SoundKit Performance Summary");
    expect(html).toContain("12,500");
  });
});
