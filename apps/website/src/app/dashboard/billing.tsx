import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/billing")({
  beforeLoad: () => {
    throw redirect({ to: "/library/settings" });
  },
});
