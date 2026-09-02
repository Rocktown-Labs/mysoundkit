import { createFileRoute } from "@tanstack/react-router";

import { VideoDetailPage } from "@/components/explore/video-detail-page";
import {
  absoluteSiteUrl,
  createShareMeta,
  seoDescription,
  seoImageUrl,
} from "@/lib/seo";
import { loadPublicVideoSeo } from "@/lib/seo-data";
import type { VideoSeoData } from "@/lib/seo-data";

export const Route = createFileRoute("/_explore/videos/$regionSlug/$slug")({
  component: RegionSlugVideoPage,
  ssr: "data-only",
  head: ({ loaderData, params }) => {
    const video = loaderData as unknown as VideoSeoData | null,
      canonicalPath =
        video?.regionSlug && video.slug
          ? `/videos/${video.regionSlug}/${video.slug}`
          : `/videos/${params.regionSlug}/${params.slug}`,
      videoTitle = video?.title ?? "Video",
      creatorName = video?.creatorName ?? "SoundKit creator",
      title = `Watch ${videoTitle} by ${creatorName} on SoundKit`,
      description = seoDescription(
        video?.description,
        `Watch ${videoTitle} by ${creatorName} on SoundKit.`
      ),
      head = createShareMeta({
        canonicalPath,
        description,
        imageUrl: video?.thumbnailUrl,
        title,
        type: "website",
      });

    return {
      ...head,
      scripts: video
        ? [
            {
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "VideoObject",
                creator: {
                  "@type": "MusicGroup",
                  name: creatorName,
                },
                description,
                name: videoTitle,
                thumbnailUrl: seoImageUrl(video.thumbnailUrl),
                url: absoluteSiteUrl(canonicalPath),
              }),
              type: "application/ld+json",
            },
          ]
        : [],
    };
  },
  loader: ({ params }) => loadPublicVideoSeo(params.slug).catch(() => null),
});

function RegionSlugVideoPage() {
  const { slug } = Route.useParams();

  return <VideoDetailPage lookupId={slug} />;
}
