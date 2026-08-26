import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/ads")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/career/ads" });
  },
});
