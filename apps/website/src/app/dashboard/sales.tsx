import { createFileRoute, Navigate } from "@tanstack/react-router";

const LegacySalesRedirect = () => (
  <Navigate to="/dashboard/career/payments" />
);

export const Route = createFileRoute("/dashboard/sales")({
  component: LegacySalesRedirect,
});
