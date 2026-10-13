import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function RecentlyPlayedScreen() {
  return (
    <NativePlaceholderScreen
      description="Pick up where you left off with your recent listening."
      route="/library/recent"
      section="Library"
      sectionHref="/library"
      title="Recently Played"
    />
  );
}
