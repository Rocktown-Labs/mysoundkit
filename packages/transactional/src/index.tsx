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
