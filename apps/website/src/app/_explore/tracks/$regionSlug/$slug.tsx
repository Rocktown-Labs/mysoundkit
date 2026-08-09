import { createFileRoute } from "@tanstack/react-router";

import { TrackDetailPage } from "@/components/explore/track-detail-page";
import {
  absoluteSiteUrl,
  createShareMeta,
  seoDescription,
  seoImageUrl,
} from "@/lib/seo";
import { loadPublicTrackSeo } from "@/lib/seo-data";
import type { TrackSeoData } from "@/lib/seo-data";

export const Route = createFileRoute("/_explore/tracks/$regionSlug/$slug")({
  component: RegionSlugTrackPage,
  head: ({ loaderData, params }) => {
    const track = loaderData as TrackSeoData | null;
    const canonicalPath =
      track?.regionSlug && track.slug
        ? `/tracks/${track.regionSlug}/${track.slug}`
        : `/tracks/${params.regionSlug}/${params.slug}`;
    const trackTitle = track?.title ?? "Track";
    const artistName = track?.artist.name ?? "SoundKit artist";
    const title = `Stream ${trackTitle} by ${artistName} on SoundKit`;
    const description = seoDescription(
      track?.description,
      `Play ${trackTitle} by ${artistName} on SoundKit.`
    );
    const head = createShareMeta({
      canonicalPath,
      description,
      imageUrl: track?.coverArtUrl,
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
                  url: absoluteSiteUrl(`/artist/${track.artist.handle}`),
                },
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
  loader: ({ params }) => loadPublicTrackSeo(params.slug).catch(() => null),
});

function RegionSlugTrackPage() {
  const { slug } = Route.useParams();

  return <TrackDetailPage lookupId={slug} />;
}
