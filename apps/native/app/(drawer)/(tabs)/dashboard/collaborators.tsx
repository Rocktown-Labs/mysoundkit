import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function DashboardNetworkScreen() {
  return (
    <NativePlaceholderScreen
      description="Manage followers, friends, and artist relationships."
      route="/dashboard/collaborators"
      section="Dashboard"
      sectionHref="/dashboard"
      title="Network"
    />
  );
}
