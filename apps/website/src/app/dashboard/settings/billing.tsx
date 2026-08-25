import { createFileRoute, Navigate } from "@tanstack/react-router";

const LegacyBillingSettingsRedirect = () => (
  <Navigate to="/library/settings" />
);

export const Route = createFileRoute("/dashboard/settings/billing")({
  component: LegacyBillingSettingsRedirect,
});
