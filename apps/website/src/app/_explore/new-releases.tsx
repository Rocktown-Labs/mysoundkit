import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_explore/new-releases")({
  beforeLoad: () => {
    throw redirect({
      search: { genre: "all", sort: "date-desc", view: "all" },
      to: "/tracks",
    });
  },
});
