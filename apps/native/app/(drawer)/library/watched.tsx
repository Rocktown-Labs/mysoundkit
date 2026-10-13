import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function RecentlyWatchedScreen() {
  return (
    <NativePlaceholderScreen
      description="Return to videos you have watched on SoundKit."
      route="/library/watched"
      section="Library"
      sectionHref="/library"
      title="Recently Watched"
    />
  );
}
