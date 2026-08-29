import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/projects/$id")({
  component: () => <Outlet />,
});
