import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/music")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/tracks" });
  },
});
