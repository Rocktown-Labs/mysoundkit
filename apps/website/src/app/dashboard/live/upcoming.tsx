import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/live/upcoming")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/live/battles" });
  },
});
