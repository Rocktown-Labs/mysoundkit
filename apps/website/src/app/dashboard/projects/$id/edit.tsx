import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/projects/$id/edit")({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: { id: params.id },
      to: "/dashboard/projects/$id",
    });
  },
});
