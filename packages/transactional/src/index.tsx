/* eslint-disable jsdoc/check-tag-names */
/** @jsxImportSource react */
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";

const brandPurple = "#A798FF",
  deepPurple = "#7C5CFF",
  mutedText = "#B8B4C7",
  panelBlack = "#0B0B12",
  surfaceBlack = "#050509",
  white = "#FFFFFF",
  noLinks: NonNullable<TransactionalNotificationEmailProps["links"]> = [];

export interface TrackLifecycleEmailProps {
  actionUrl: string;
  assetBaseUrl: string;
  artistName: string;
  eventType?: "track_ready" | "track_processing_ready";
  previewText: string;
  trackTitle: string;
}

export interface TransactionalNotificationEmailProps {
  actionUrl: string;
  assetBaseUrl: string;
  body: string;
  ctaLabel: string;
  eyebrow: string;
  footerNote: string;
  heading: string;
  links?: {
    description?: string;
    href: string;
    label: string;
  }[];
  previewText: string;
  recipientName: string;
}

const getSocialCardUrl = (assetBaseUrl: string) =>
  `${assetBaseUrl.replace(/\/$/u, "")}/soundkit-social-card.png`;

export function TransactionalNotificationEmail({
  actionUrl,
  assetBaseUrl,
  body,
  ctaLabel,
  eyebrow,
  footerNote,
  heading,
  links = noLinks,
  previewText,
  recipientName,
}: TransactionalNotificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: surfaceBlack,
          color: white,
          fontFamily:
            'Geist, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          margin: 0,
          padding: "32px 12px",
        }}
      >
        <Container
          style={{
            backgroundColor: panelBlack,
            border: "1px solid #242032",
            borderRadius: "8px",
            margin: "0 auto",
            maxWidth: "600px",
            overflow: "hidden",
          }}
        >
          <Img
            alt="SoundKit"
            height="315"
            src={getSocialCardUrl(assetBaseUrl)}
            style={{
              display: "block",
              height: "auto",
              width: "100%",
            }}
            width="600"
          />
          <Section style={{ padding: "32px 28px 12px" }}>
            <Text
              style={{
                color: brandPurple,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                lineHeight: "18px",
                margin: "0 0 12px",
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </Text>
            <Heading
              as="h1"
              style={{
                color: white,
                fontSize: "30px",
                fontWeight: 800,
                letterSpacing: "0",
                lineHeight: "36px",
                margin: "0 0 16px",
              }}
            >
              {heading}
            </Heading>
            <Text
              style={{
                color: mutedText,
                fontSize: "16px",
                lineHeight: "26px",
                margin: "0 0 20px",
              }}
            >
              Hey {recipientName},
            </Text>
            <Text
              style={{
                color: mutedText,
                fontSize: "15px",
                lineHeight: "25px",
                margin: "0 0 28px",
              }}
            >
              {body}
            </Text>
            {links.length > 0 ? (
              <Section style={{ margin: "0 0 28px" }}>
                {links.map((link) => (
                  <Section
                    key={link.href}
                    style={{
                      border: "1px solid #242032",
                      borderRadius: "8px",
                      margin: "0 0 10px",
                      padding: "14px 16px",
                    }}
                  >
                    <Link
                      href={link.href}
                      style={{
                        color: white,
                        display: "block",
                        fontSize: "15px",
                        fontWeight: 700,
                        lineHeight: "22px",
                        textDecoration: "none",
                      }}
                    >
                      {link.label}
                    </Link>
                    {link.description ? (
                      <Text
                        style={{
                          color: mutedText,
                          fontSize: "13px",
                          lineHeight: "20px",
                          margin: "4px 0 0",
                        }}
                      >
                        {link.description}
                      </Text>
                    ) : null}
                  </Section>
                ))}
              </Section>
            ) : null}
            <Button
              href={actionUrl}
              style={{
                backgroundColor: deepPurple,
                borderRadius: "8px",
                boxSizing: "border-box",
                color: white,
                display: "inline-block",
                fontSize: "15px",
                fontWeight: 700,
                lineHeight: "20px",
                padding: "14px 22px",
                textDecoration: "none",
              }}
            >
              {ctaLabel}
            </Button>
          </Section>
          <Section style={{ padding: "10px 28px 28px" }}>
            <Hr
              style={{
                borderColor: "#242032",
                borderStyle: "solid",
                borderWidth: "1px 0 0",
                margin: "24px 0",
              }}
            />
            <Text
              style={{
                color: "#807A93",
                fontSize: "12px",
                lineHeight: "20px",
                margin: 0,
              }}
            >
              {footerNote}
            </Text>
            <Text
              style={{
                color: "#807A93",
                fontSize: "12px",
                lineHeight: "20px",
                margin: "12px 0 0",
              }}
            >
              <Link
                href={actionUrl}
                style={{ color: brandPurple, textDecoration: "none" }}
              >
                SoundKit artist dashboard
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export type BattleOutcomeEmailAudience = "artist" | "viewer";
export type BattleOutcomeEmailKind =
  | "canceled"
  | "ducked"
  | "forfeited"
  | "quit";

export interface BattleOutcomeEmailProps {
  actionUrl: string;
  affectedArtistName?: string | null;
  assetBaseUrl: string;
  audience: BattleOutcomeEmailAudience;
  battleTitle: string;
  kind: BattleOutcomeEmailKind;
  reason: string;
  recipientName: string;
}

const getBattleOutcomeCopy = ({
  affectedArtistName,
  audience,
  battleTitle,
  kind,
  reason,
}: Omit<
  BattleOutcomeEmailProps,
  "actionUrl" | "assetBaseUrl" | "recipientName"
>) => {
  if (audience === "artist") {
    const explicitForfeit = kind === "forfeited",
      quit = kind === "quit";
    return {
      body: quit
        ? `You quit “${battleTitle}” before the match was complete. Your battle participation has been recorded, and no rating was changed.`
        : explicitForfeit
          ? `We heard the news: you forfeited “${battleTitle}”. On SoundKit, stepping away from an active match is recorded as ducking the smoke. No rating was changed.`
          : `We heard the news: you were marked as the artist who ducked “${battleTitle}” because you did not show up in the waiting room. No rating was changed. If this was a mistake, contact SoundKit support.`,
      ctaLabel: "Open artist battles",
      eyebrow: quit
        ? "Battle quit"
        : explicitForfeit
          ? "Battle forfeit"
          : "Battle no-show",
      footerNote:
        "You are receiving this because an outcome was recorded for a battle involving your SoundKit artist account.",
      heading: quit ? "You quit the battle" : "You Ducked the Smoke",
      previewText: quit
        ? `You quit ${battleTitle}.`
        : explicitForfeit
          ? `Your forfeit ended ${battleTitle}.`
          : `You were marked as ducking ${battleTitle}.`,
    };
  }

  const artistName = affectedArtistName ?? "One of the artists",
    isPlatformIssue =
      reason === "platform_issue" || reason === "technical_issue";
  if (kind === "ducked") {
    return {
      body: `Unfortunately, ${artistName} ducked the smoke in “${battleTitle}”, so the battle was canceled before a rated result. No ratings were changed.`,
      ctaLabel: "View battle outcome",
      eyebrow: "Battle canceled",
      footerNote:
        "You are receiving this because you joined or watched this SoundKit battle.",
      heading: "The battle was ducked",
      previewText: `${artistName} ducked the smoke. ${battleTitle} was canceled.`,
    };
  }

  if (kind === "forfeited" || kind === "quit") {
    const didQuit = kind === "quit";
    return {
      body: `${artistName} ${didQuit ? "quit" : "forfeited"} “${battleTitle}”. The battle has ended, and no new audience votes or rating changes will be recorded.`,
      ctaLabel: "View battle outcome",
      eyebrow: "Battle ended",
      footerNote:
        "You are receiving this because you joined or watched this SoundKit battle.",
      heading: didQuit
        ? "The battle ended when an artist quit"
        : "The battle ended by forfeit",
      previewText: `${artistName} ${didQuit ? "quit" : "forfeited"} ${battleTitle}.`,
    };
  }

  return {
    body: isPlatformIssue
      ? `SoundKit dropped the ball on “${battleTitle}”, so we canceled the battle before a rated result. We are sorry for the interruption. No ratings were changed.`
      : `“${battleTitle}” was canceled before a rated result was recorded. No ratings were changed.`,
    ctaLabel: "View battle outcome",
    eyebrow: isPlatformIssue ? "SoundKit platform issue" : "Battle canceled",
    footerNote:
      "You are receiving this because you joined or watched this SoundKit battle.",
    heading: isPlatformIssue
      ? "SoundKit canceled the battle"
      : "The battle was canceled",
    previewText: isPlatformIssue
      ? `${battleTitle} was canceled because of a SoundKit platform issue.`
      : `${battleTitle} was canceled before a result.`,
  };
};

export function BattleOutcomeEmail({
  actionUrl,
  affectedArtistName,
  assetBaseUrl,
  audience,
  battleTitle,
  kind,
  reason,
  recipientName,
}: BattleOutcomeEmailProps) {
  const copy = getBattleOutcomeCopy({
    affectedArtistName,
    audience,
    battleTitle,
    kind,
    reason,
  });
  return (
    <TransactionalNotificationEmail
      actionUrl={actionUrl}
      assetBaseUrl={assetBaseUrl}
      recipientName={recipientName}
      {...copy}
    />
  );
}

export interface RenderBattleOutcomeEmailOptions extends BattleOutcomeEmailProps {
  subject: string;
}

export async function renderBattleOutcomeEmail(
  options: RenderBattleOutcomeEmailOptions
) {
  const { subject, ...props } = options,
    element = <BattleOutcomeEmail {...props} />,
    [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

  return { html, subject, text };
}

const getTrackLifecycleCopy = ({
  eventType = "track_ready",
  trackTitle,
}: {
  eventType?: "track_ready" | "track_processing_ready";
  trackTitle: string;
}) => {
  if (eventType === "track_processing_ready") {
    return {
      body: `${trackTitle} has new track details ready to review, including lyric timing where available. Take a look and make any edits before you use it in battles or releases.`,
      ctaLabel: "Review details",
      eyebrow: "Ready to review",
      footerNote:
        "You are receiving this because track update emails are turned on for your SoundKit account.",
      heading: "Your track details are ready",
    };
  }

  return {
    body: `${trackTitle} is ready with the audio, cover art, duration, and release details SoundKit needs. You can open the track now and review everything in your dashboard.`,
    ctaLabel: "Open track",
    eyebrow: "Track ready",
    footerNote:
      "You are receiving this because track update emails are turned on for your SoundKit account.",
    heading: "Your track is ready",
  };
};

export function TrackLifecycleEmail({
  actionUrl,
  assetBaseUrl,
  artistName,
  eventType = "track_ready",
  previewText,
  trackTitle,
}: TrackLifecycleEmailProps) {
  return (
    <TransactionalNotificationEmail
      actionUrl={actionUrl}
      assetBaseUrl={assetBaseUrl}
      previewText={previewText}
      recipientName={artistName}
      {...getTrackLifecycleCopy({ eventType, trackTitle })}
    />
  );
}

export interface RenderTrackLifecycleEmailOptions {
  actionUrl: string;
  assetBaseUrl: string;
  artistName: string;
  eventType?: "track_ready" | "track_processing_ready";
  trackTitle: string;
}

export async function renderTrackLifecycleEmail(
  options: RenderTrackLifecycleEmailOptions
) {
  const previewText =
      options.eventType === "track_processing_ready"
        ? `${options.trackTitle} has new details ready to review.`
        : `${options.trackTitle} is ready in your SoundKit dashboard.`,
    element = <TrackLifecycleEmail {...options} previewText={previewText} />,
    [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

  return { html, text };
}

export interface RenderTransactionalNotificationEmailOptions extends TransactionalNotificationEmailProps {
  subject: string;
}

export async function renderTransactionalNotificationEmail(
  options: RenderTransactionalNotificationEmailOptions
) {
  const element = <TransactionalNotificationEmail {...options} />,
    [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

  return { html, subject: options.subject, text };
}
