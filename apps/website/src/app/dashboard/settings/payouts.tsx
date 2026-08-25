import { createFileRoute, Navigate } from "@tanstack/react-router";

const LegacyPayoutSettingsRedirect = () => (
  <Navigate to="/dashboard/career/payments" />
);

export const Route = createFileRoute("/dashboard/settings/payouts")({
  component: LegacyPayoutSettingsRedirect,
});
