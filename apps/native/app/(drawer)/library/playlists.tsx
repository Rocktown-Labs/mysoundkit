import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function PlaylistsScreen() {
  return (
    <NativePlaceholderScreen
      description="Organize your favorite listening into playlists."
      route="/library/playlists"
      section="Library"
      sectionHref="/library"
      title="Playlists"
    />
  );
}
