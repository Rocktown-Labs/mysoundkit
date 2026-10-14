import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { NativeStackLayout } from "@/components/native-stack-layout";
import { authClient } from "@/lib/auth-client";

export default function LibraryLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#020202",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#B8A3FF" size="large" />
      </View>
    );
  }

  if (!session?.user) {
    return <Redirect href="/login?redirect=/library" />;
  }

  return <NativeStackLayout />;
}
