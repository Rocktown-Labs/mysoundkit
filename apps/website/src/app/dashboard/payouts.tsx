import { createFileRoute, Navigate } from "@tanstack/react-router";

const LegacyPayoutsRedirect = () => (
  <Navigate to="/dashboard/career/payments" />
);

export const Route = createFileRoute("/dashboard/payouts")({
  component: LegacyPayoutsRedirect,
});
