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

const brandPurple = "#A798FF";
const deepPurple = "#7C5CFF";
const surfaceBlack = "#050509";
const panelBlack = "#0B0B12";
const mutedText = "#B8B4C7";
const white = "#FFFFFF";

export interface TrackLifecycleEmailProps {
  actionUrl: string;
  assetBaseUrl: string;
  artistName: string;
  previewText: string;
  processingComplete?: boolean;
  trackTitle: string;
}

const getSocialCardUrl = (assetBaseUrl: string) =>
  `${assetBaseUrl.replace(/\/$/u, "")}/soundkit-social-card.png`;

export function TrackLifecycleEmail({
  actionUrl,
  assetBaseUrl,
  artistName,
  previewText,
  processingComplete = false,
  trackTitle,
}: TrackLifecycleEmailProps) {
  const heading = processingComplete
    ? "Premium processing is complete"
    : "Your track is live";
  const eyebrow = processingComplete ? "Premium pipeline" : "Track ready";
  const bodyCopy = processingComplete
    ? "StemSplit assets, audio analysis, and lyric timing have finished processing. Everything is ready for review in your artist dashboard."
    : "Your upload has settled with the audio file, cover art, duration, and release details SoundKit needs. It is ready for listeners.";
  const cta = processingComplete ? "Review track" : "Open track";

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
              Hey {artistName}, {trackTitle} is ready.
            </Text>
            <Text
              style={{
                color: mutedText,
                fontSize: "15px",
                lineHeight: "25px",
                margin: "0 0 28px",
              }}
            >
              {bodyCopy}
            </Text>
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
              {cta}
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
              You are receiving this because track processing emails are enabled
              in SoundKit. Manage email preferences in your dashboard settings.
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

export interface RenderTrackLifecycleEmailOptions {
  actionUrl: string;
  assetBaseUrl: string;
  artistName: string;
  processingComplete?: boolean;
  trackTitle: string;
}

export async function renderTrackLifecycleEmail(
  options: RenderTrackLifecycleEmailOptions
) {
  const previewText = options.processingComplete
    ? `${options.trackTitle} finished premium processing on SoundKit.`
    : `${options.trackTitle} is live on SoundKit.`;
  const element = (
    <TrackLifecycleEmail {...options} previewText={previewText} />
  );

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { html, text };
}
