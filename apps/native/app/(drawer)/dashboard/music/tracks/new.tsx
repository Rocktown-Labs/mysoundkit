import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function NewTrackScreen() {
  return (
    <NativePlaceholderScreen
      description="Upload a song, cover artwork, and release details."
      route="/dashboard/tracks/new"
      section="Dashboard"
      sectionHref="/dashboard"
      title="New Track"
    />
  );
}
