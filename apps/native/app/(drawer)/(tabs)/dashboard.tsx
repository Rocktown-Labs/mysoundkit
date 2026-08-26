import { Text } from "react-native";

import { NativeSectionScreen } from "@/components/native-section-screen";

export default function DashboardScreen() {
  return (
    <NativeSectionScreen
      description="Creator catalog, community, messages, live tools, and career destinations belong to this stack."
      title="Dashboard"
    >
      <Text>
        Creator workflows can be added without changing tab ownership.
      </Text>
    </NativeSectionScreen>
  );
}
