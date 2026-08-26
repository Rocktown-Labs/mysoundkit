import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/finance")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/career/payments" });
  },
});
