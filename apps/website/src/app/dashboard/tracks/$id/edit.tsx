import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/tracks/$id/edit")({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: { id: params.id },
      to: "/dashboard/tracks/$id",
    });
  },
});
