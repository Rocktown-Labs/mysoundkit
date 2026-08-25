import { createFileRoute, Navigate } from "@tanstack/react-router";

const LegacyBillingRedirect = () => <Navigate to="/library/settings" />;

export const Route = createFileRoute("/dashboard/billing")({
  component: LegacyBillingRedirect,
});
