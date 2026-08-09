import { createFileRoute, Outlet } from "@tanstack/react-router";

import { createShareMeta } from "@/lib/seo";

export const Route = createFileRoute("/_explore/projects/$id")({
  component: ProjectDetailLayout,
  head: ({ params }) =>
    createShareMeta({
      canonicalPath: `/projects/${params.id}`,
      description:
        "Play albums, EPs, and mixtapes from SoundKit creators with full project tracklists.",
      title: "Play this project on SoundKit",
      type: "music.album",
    }),
});

function ProjectDetailLayout() {
  return <Outlet />;
}
