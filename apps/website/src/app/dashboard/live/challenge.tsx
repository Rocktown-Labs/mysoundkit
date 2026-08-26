import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/live/challenge")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/live/battles" });
  },
});
