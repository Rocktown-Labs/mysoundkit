import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function Home() {
  const { colorScheme } = useColorScheme(),
   theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
   { data: session } = authClient.useSession();

  return (
    <Container>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            BETTER T STACK
          </Text>

          {session?.user ? (
            <View
              style={[
                styles.userCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.userHeader}>
                <Text style={[styles.userText, { color: theme.text }]}>
                  Welcome,{" "}
                  <Text style={styles.userName}>{session.user.name}</Text>
                </Text>
              </View>
              <Text
                style={[styles.userEmail, { color: theme.text, opacity: 0.7 }]}
              >
                {session.user.email}
              </Text>
              <TouchableOpacity
                style={[
                  styles.signOutButton,
                  { backgroundColor: theme.notification },
                ]}
                onPress={() => {
                  authClient.signOut();
                }}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!session?.user && (
            <>
              <SignIn />
              <SignUp />
            </>
          )}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  content: {
    padding: 16,
  },
  privateDataCard: {
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  privateDataText: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  signOutButton: {
    padding: 12,
  },
  signOutText: {
    color: "#ffffff",
  },
  statusCard: {
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  statusContent: {
    flex: 1,
  },
  statusIndicator: {
    height: 8,
    width: 8,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statusText: {
    fontSize: 12,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  userCard: {
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 12,
  },
  userHeader: {
    marginBottom: 8,
  },
  userName: {
    fontWeight: "bold",
  },
  userText: {
    fontSize: 16,
  },
});
