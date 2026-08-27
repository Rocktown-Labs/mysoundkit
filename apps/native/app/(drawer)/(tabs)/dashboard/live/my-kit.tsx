import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function DashboardKitsScreen() {
  return (
    <NativePlaceholderScreen
      description="Configure battle kits, format slots, and track picks."
      route="/dashboard/live/my-kit"
      section="Dashboard"
      sectionHref="/dashboard"
      title="My Kits"
    />
  );
}
