import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/career/ai-studio")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/career/ads" });
  },
});
