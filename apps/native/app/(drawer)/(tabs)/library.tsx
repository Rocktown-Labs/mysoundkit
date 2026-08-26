import { Text } from "react-native";

import { NativeSectionScreen } from "@/components/native-section-screen";

export default function LibraryScreen() {
  return (
    <NativeSectionScreen
      description="Saved tracks, listening history, purchases, and playlists belong to this stack."
      title="Library"
    >
      <Text>
        Library collections will appear here as native detail screens land.
      </Text>
    </NativeSectionScreen>
  );
}
