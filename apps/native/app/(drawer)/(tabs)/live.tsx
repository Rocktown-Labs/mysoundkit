import { Text } from "react-native";

import { NativeSectionScreen } from "@/components/native-section-screen";

export default function LiveScreen() {
  return (
    <NativeSectionScreen
      description="Battles, listening parties, and creator streams share this native stack."
      title="Live"
    >
      <Text>
        Live destinations are explicitly reserved in the route manifest.
      </Text>
    </NativeSectionScreen>
  );
}
