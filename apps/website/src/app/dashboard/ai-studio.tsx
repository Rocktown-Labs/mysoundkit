import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/ai-studio")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/career/ads" });
  },
});
