import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function LibrarySettingsScreen() {
  return (
    <NativePlaceholderScreen
      description="Manage your account, notifications, and listener settings."
      route="/library/settings"
      section="Library"
      sectionHref="/library"
      title="Account"
    />
  );
}
