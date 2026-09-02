import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function SavedTracksScreen() {
  return (
    <NativePlaceholderScreen
      description="Keep the tracks you love close at hand."
      route="/library/saved"
      section="Library"
      sectionHref="/library"
      title="Saved Tracks"
    />
  );
}
