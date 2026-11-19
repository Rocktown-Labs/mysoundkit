import { createFileRoute } from "@tanstack/react-router";

import { MerchStudio } from "@/components/merch/merch-studio";

export const Route = createFileRoute("/dashboard/career/merch")({
  component: MerchStudio,
});
