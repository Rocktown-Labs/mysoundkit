import { createFileRoute } from "@tanstack/react-router";

import { TrackDetailPage } from "@/components/explore/track-detail-page";
import {
  absoluteSiteUrl,
  createShareMeta,
  seoDescription,
  seoImageUrl,
  seoOgDescription,
} from "@/lib/seo";
import { loadPublicTrackSeo } from "@/lib/seo-data";
import type { TrackSeoData } from "@/lib/seo-data";

export const Route = createFileRoute("/_explore/tracks/$id")({
  component: LegacyTrackPage,
  head: ({ loaderData, params }) => {
    const track = loaderData as TrackSeoData | null;
    const canonicalPath =
      track?.regionSlug && track.slug
        ? `/tracks/${track.regionSlug}/${track.slug}`
        : `/tracks/${params.id}`;
    const trackTitle = track?.title ?? "Track";
    const artistName = track?.artist.name ?? "SoundKit artist";
    const title = `Stream ${trackTitle} by ${artistName} on SoundKit`;
    const artistUrl = absoluteSiteUrl(`/artist/${track?.artist.handle ?? "artist"}`);
    const genre = track?.genre ? `${track.genre} track` : "track";
    const descriptionFallback = `Play ${trackTitle} by ${artistName} on SoundKit.`;
    const description = seoDescription(track?.description, descriptionFallback);
    const ogDescription = seoOgDescription(
      track?.description,
      `Play ${trackTitle} by ${artistName} on SoundKit — a ${genre} you can stream right now.`
    );
    const head = createShareMeta({
      canonicalPath,
      description,
      imageUrl: track?.coverArtUrl,
      ogDescription,
      song: {
        audioUrl: track?.playbackUrl,
        durationMs: track?.durationMs,
        musicianUrl: artistUrl,
      },
      title,
      type: "music.song",
    });

    return {
      ...head,
      scripts: track
        ? [
            {
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "MusicRecording",
                byArtist: {
                  "@type": "MusicGroup",
                  name: artistName,
                  url: artistUrl,
                },
                duration:
                  track.durationMs != null
                    ? `PT${Math.round(track.durationMs / 1000)}S`
                    : undefined,
                image: seoImageUrl(track.coverArtUrl),
                name: trackTitle,
                url: absoluteSiteUrl(canonicalPath),
              }),
              type: "application/ld+json",
            },
          ]
        : [],
    };
  },
  loader: ({ params }) => loadPublicTrackSeo(params.id).catch(() => null),
});

function LegacyTrackPage() {
  const { id } = Route.useParams();

  return <TrackDetailPage lookupId={id} />;
}
