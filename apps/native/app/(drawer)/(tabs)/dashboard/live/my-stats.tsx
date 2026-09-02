import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function DashboardStatsScreen() {
  return (
    <NativePlaceholderScreen
      description="Review battle performance by track."
      route="/dashboard/live/my-stats"
      section="Dashboard"
      sectionHref="/dashboard"
      title="My Stats"
    />
  );
}
