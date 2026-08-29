import { createFileRoute, Outlet } from "@tanstack/react-router";

import {
  absoluteSiteUrl,
  createShareMeta,
  seoDescription,
  seoImageUrl,
} from "@/lib/seo";
import { loadPublicProjectSeo } from "@/lib/seo-data";
import type { ProjectSeoData } from "@/lib/seo-data";

export const Route = createFileRoute("/_explore/projects/$id")({
  component: ProjectDetailLayout,
  head: ({ loaderData, params }) => {
    const project = loaderData as unknown as ProjectSeoData | null,
      titleText = project?.title ?? "Project",
      artistName = project?.artistName ?? "SoundKit artist",
      title = `Play ${titleText} by ${artistName} on SoundKit`,
      description = seoDescription(
        project?.description,
        `Stream ${titleText}, a ${project?.projectType ?? "project"} by ${artistName}, on SoundKit.`
      ),
      head = createShareMeta({
        canonicalPath: `/projects/${project?.id ?? params.id}`,
        description,
        imageUrl: project?.coverArtUrl,
        title,
        type: "music.album",
      });

    return {
      ...head,
      scripts: project
        ? [
            {
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "MusicAlbum",
                byArtist: {
                  "@type": "MusicGroup",
                  name: artistName,
                },
                image: seoImageUrl(project.coverArtUrl),
                name: titleText,
                numTracks: project.trackCount,
                url: absoluteSiteUrl(`/projects/${project.slug || project.id}`),
              }),
              type: "application/ld+json",
            },
          ]
        : [],
    };
  },
  loader: ({ params }) => loadPublicProjectSeo(params.id).catch(() => null),
});

function ProjectDetailLayout() {
  return <Outlet />;
}
