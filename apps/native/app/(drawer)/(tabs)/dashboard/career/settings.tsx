import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function CareerSettingsScreen() {
  return (
    <NativePlaceholderScreen
      description="Manage account, notifications, and artist settings."
      route="/dashboard/career/settings"
      section="Dashboard"
      sectionHref="/dashboard"
      title="Settings"
    />
  );
}
