/* oxlint-disable one-var, sort-vars, sort-keys, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { API_BASE_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  useBillingCheckoutMutation,
  useBillingPortalMutation,
  useMeEntitlementsQuery,
  useMeNotificationSettingsQuery,
  useMeQuery,
  useUpdateMeNotificationSettingsMutation,
  useUpdateMeProfileMutation,
} from "@/lib/soundkit-api";

type MediaLayoutMode = "cards" | "list";

const NOTIFICATION_ITEMS = [
  {
    description: "Get notified when artists release new tracks",
    key: "pushReleases",
    label: "New Music from Artists",
  },
  {
    description: "Notifications when battles and streams go live",
    key: "emailLive",
    label: "Live Battle & Stream Alerts",
  },
  {
    description: "Get notified when listeners follow you or comment",
    key: "emailFollowers",
    label: "Followers & Activity",
  },
  {
    description: "Alerts for community posts and mentions",
    key: "communityPosts",
    label: "Community Updates",
  },
] as const;

export default function LibrarySettingsScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);
  const meQuery = useMeQuery(isSignedIn);
  const entitlementsQuery = useMeEntitlementsQuery(isSignedIn);
  const notificationSettingsQuery = useMeNotificationSettingsQuery(isSignedIn);
  const updateProfileMutation = useUpdateMeProfileMutation();
  const updateNotificationsMutation = useUpdateMeNotificationSettingsMutation();
  const checkoutMutation = useBillingCheckoutMutation();
  const portalMutation = useBillingPortalMutation();

  const meUser = meQuery.data?.user ?? null;
  const sessionUser = session?.user ?? null;

  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(
    null
  );
  const [cityOverride, setCityOverride] = useState<string | null>(null);
  const [stateOverride, setStateOverride] = useState<string | null>(null);
  const [mediaLayoutOverride, setMediaLayoutOverride] =
    useState<MediaLayoutMode | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [notificationOverrides, setNotificationOverrides] = useState<
    Partial<{
      communityPosts: boolean;
      emailFollowers: boolean;
      emailLive: boolean;
      pushReleases: boolean;
    }>
  >({});

  const displayName =
    displayNameOverride ?? meUser?.displayName ?? sessionUser?.name ?? "";
  const city = cityOverride ?? meUser?.city ?? "";
  const stateValue = stateOverride ?? meUser?.state ?? "";
  const mediaLayout: MediaLayoutMode =
    mediaLayoutOverride ?? meUser?.mediaLayout ?? "cards";

  const notificationState = {
    communityPosts:
      notificationOverrides.communityPosts ??
      notificationSettingsQuery.data?.communityPosts ??
      true,
    emailFollowers:
      notificationOverrides.emailFollowers ??
      notificationSettingsQuery.data?.emailFollowers ??
      true,
    emailLive:
      notificationOverrides.emailLive ??
      notificationSettingsQuery.data?.emailLive ??
      true,
    pushReleases:
      notificationOverrides.pushReleases ??
      notificationSettingsQuery.data?.pushReleases ??
      true,
  };

  const fallbackUsername = sessionUser?.email
    ? `@${sessionUser.email.split("@")[0] ?? "listener"}`
    : "@listener";
  const username = meUser?.username ? `@${meUser.username}` : fallbackUsername;

  const emailAddress = sessionUser?.email ?? "";
  const isPremium = entitlementsQuery.data?.isPremium === true;
  const billingPending = checkoutMutation.isPending || portalMutation.isPending;
  const subscriptionCtaLabel = isPremium
    ? "Manage Premium"
    : "Upgrade to Premium";

  const handleSaveProfile = (nextLayout?: MediaLayoutMode) => {
    const layoutToSave = nextLayout ?? mediaLayout;
    setProfileNotice(null);
    updateProfileMutation.mutate(
      {
        city: city.trim() || undefined,
        displayName: displayName.trim() || undefined,
        mediaLayout: layoutToSave,
        state: stateValue.trim() || undefined,
      },
      {
        onError: (err) => {
          setProfileNotice(
            err instanceof Error ? err.message : "Could not save changes."
          );
        },
        onSuccess: () => {
          setProfileNotice("Account preferences saved.");
        },
      }
    );
  };

  const handleToggleNotification = (
    key: keyof typeof notificationState,
    value: boolean
  ) => {
    setNotificationOverrides((prev) => ({ ...prev, [key]: value }));
    updateNotificationsMutation.mutate({ [key]: value });
  };

  const handleSubscriptionAction = async () => {
    setCheckoutNotice(null);
    try {
      if (isPremium) {
        const res = await portalMutation.mutateAsync({
          customerType: "organization",
          returnUrl: `${API_BASE_URL}/library/settings`,
        });
        if (res.portalUrl) {
          await Linking.openURL(res.portalUrl);
          return;
        }
        setCheckoutNotice(
          "Premium is active on this account, but there is no recurring billing to manage."
        );
        return;
      }

      const planCode =
        meUser?.accountType === "artist" ? "artist_pro" : "fan_plus";
      const res = await checkoutMutation.mutateAsync({
        cancelUrl: `${API_BASE_URL}/library/settings`,
        customerType: "organization",
        planCode,
        successUrl: `${API_BASE_URL}/library/settings?upgraded=1`,
      });
      if (res.checkoutUrl) {
        await Linking.openURL(res.checkoutUrl);
        return;
      }
      setCheckoutNotice(
        res.setupRequired
          ? "Premium checkout is not available right now."
          : "Your account is already set for this plan."
      );
    } catch {
      setCheckoutNotice(
        "Could not open billing right now. Please try again in a moment."
      );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Library",
          headerShown: true,
          headerStyle: { backgroundColor: "#060606" },
          headerTintColor: "#FFFFFF",
          title: "Account Settings",
        }}
      />
      <Container>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                router.push("/library" as never);
              }}
              style={styles.backRow}
            >
              <Ionicons color="#B8A3FF" name="arrow-back" size={16} />
              <Text style={styles.backText}>Back to Library</Text>
            </Pressable>
            <View style={styles.titleRow}>
              <View style={styles.titleTextCol}>
                <Text style={styles.title}>Account Settings</Text>
                <Text style={styles.subtitle}>
                  Manage your account preferences
                </Text>
              </View>
            </View>
          </View>

          {isSignedIn ? (
            <>
              {/* Profile Information */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons color="#8F8F8F" name="person-outline" size={19} />
                  <Text style={styles.cardTitle}>Profile Information</Text>
                </View>

                <View style={styles.avatarRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {(displayName || sessionUser?.name || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.avatarMeta}>
                    <Text style={styles.avatarName}>
                      {displayName || sessionUser?.name || "SoundKit User"}
                    </Text>
                    {emailAddress ? (
                      <Text style={styles.avatarEmail}>{emailAddress}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Display Name</Text>
                  <TextInput
                    onChangeText={setDisplayNameOverride}
                    placeholder="How fans should see your name"
                    placeholderTextColor="#737373"
                    style={styles.input}
                    value={displayName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Username</Text>
                  <TextInput
                    editable={false}
                    style={[styles.input, styles.disabledInput]}
                    value={username}
                  />
                </View>

                {emailAddress ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <View style={styles.emailRow}>
                      <Ionicons color="#8F8F8F" name="mail-outline" size={16} />
                      <Text style={styles.emailValue}>{emailAddress}</Text>
                    </View>
                  </View>
                ) : null}

                {profileNotice ? (
                  <Text style={styles.noticeText}>{profileNotice}</Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={updateProfileMutation.isPending}
                  onPress={() => {
                    handleSaveProfile();
                  }}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {updateProfileMutation.isPending
                      ? "Saving..."
                      : "Save Changes"}
                  </Text>
                </Pressable>
              </View>

              {/* Media Layout */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons color="#8F8F8F" name="grid-outline" size={19} />
                  <Text style={styles.cardTitle}>Media Layout</Text>
                </View>
                <Text style={styles.cardDesc}>
                  Choose cards or a compact list for media collections.
                </Text>

                <View style={styles.layoutOptionsGrid}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setMediaLayoutOverride("cards");
                      handleSaveProfile("cards");
                    }}
                    style={[
                      styles.layoutOption,
                      mediaLayout === "cards" && styles.layoutOptionActive,
                    ]}
                  >
                    <View style={styles.layoutOptionHeader}>
                      <Ionicons
                        color={mediaLayout === "cards" ? "#B8A3FF" : "#FFFFFF"}
                        name="grid-outline"
                        size={16}
                      />
                      <Text style={styles.layoutOptionTitle}>Cards</Text>
                    </View>
                    <Text style={styles.layoutOptionDesc}>
                      Poster and square artwork grids with richer visuals.
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setMediaLayoutOverride("list");
                      handleSaveProfile("list");
                    }}
                    style={[
                      styles.layoutOption,
                      mediaLayout === "list" && styles.layoutOptionActive,
                    ]}
                  >
                    <View style={styles.layoutOptionHeader}>
                      <Ionicons
                        color={mediaLayout === "list" ? "#B8A3FF" : "#FFFFFF"}
                        name="list-outline"
                        size={16}
                      />
                      <Text style={styles.layoutOptionTitle}>Compact List</Text>
                    </View>
                    <Text style={styles.layoutOptionDesc}>
                      Dense rows that fit more songs, videos, and streams on
                      screen.
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Location */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons color="#8F8F8F" name="location-outline" size={19} />
                  <Text style={styles.cardTitle}>Location</Text>
                </View>
                <Text style={styles.cardDesc}>
                  Set your location for personalized recommendations
                </Text>

                <View style={styles.locationGrid}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>City</Text>
                    <TextInput
                      onChangeText={setCityOverride}
                      placeholder="City"
                      placeholderTextColor="#737373"
                      style={styles.input}
                      value={city}
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>State</Text>
                    <TextInput
                      onChangeText={setStateOverride}
                      placeholder="State"
                      placeholderTextColor="#737373"
                      style={styles.input}
                      value={stateValue}
                    />
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={updateProfileMutation.isPending}
                  onPress={() => {
                    handleSaveProfile();
                  }}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryBtnText}>Update Location</Text>
                </Pressable>
              </View>

              {/* Notifications */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons
                    color="#8F8F8F"
                    name="notifications-outline"
                    size={19}
                  />
                  <Text style={styles.cardTitle}>Notifications</Text>
                </View>

                {NOTIFICATION_ITEMS.map((item, idx) => (
                  <View
                    key={item.key}
                    style={[
                      styles.switchRow,
                      idx > 0 && styles.switchRowBorder,
                    ]}
                  >
                    <View style={styles.switchTextCol}>
                      <Text style={styles.switchLabel}>{item.label}</Text>
                      <Text style={styles.switchSublabel}>
                        {item.description}
                      </Text>
                    </View>
                    <Switch
                      onValueChange={(val) => {
                        handleToggleNotification(item.key, val);
                      }}
                      thumbColor={
                        notificationState[item.key] ? "#FFFFFF" : "#71717A"
                      }
                      trackColor={{ false: "#27272A", true: "#B8A3FF" }}
                      value={notificationState[item.key]}
                    />
                  </View>
                ))}
              </View>

              {/* Subscription */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons color="#8F8F8F" name="card-outline" size={19} />
                  <Text style={styles.cardTitle}>Subscription</Text>
                </View>

                <View style={styles.subscriptionBox}>
                  <View style={styles.subscriptionCopy}>
                    <Text style={styles.subscriptionTier}>
                      Current Plan: {isPremium ? "Premium" : "Free"}
                    </Text>
                    <Text style={styles.subscriptionDesc}>
                      {isPremium
                        ? "Premium is active. Manage billing, payment methods, or cancellation in Stripe."
                        : "Upgrade to unlock premium features."}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={billingPending}
                    onPress={() => {
                      void handleSubscriptionAction();
                    }}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {billingPending ? "Opening..." : subscriptionCtaLabel}
                    </Text>
                  </Pressable>
                  {checkoutNotice ? (
                    <Text style={styles.noticeText}>{checkoutNotice}</Text>
                  ) : null}
                </View>
              </View>

              {/* Security */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons
                    color="#8F8F8F"
                    name="shield-checkmark-outline"
                    size={19}
                  />
                  <Text style={styles.cardTitle}>Security</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void authClient.signOut();
                  }}
                  style={({ pressed }) => [
                    styles.dangerBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons color="#EF4444" name="log-out-outline" size={17} />
                  <Text style={styles.dangerBtnText}>Sign Out</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Log in to manage account settings
              </Text>
              <Text style={styles.cardDesc}>
                Log in to manage your SoundKit profile, location, notifications,
                and plan.
              </Text>
              <Link href="/login?redirect=/library/settings" asChild>
                <Pressable style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Log In</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </ScrollView>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  avatarCircle: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.16)",
    borderRadius: 999,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  avatarEmail: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  avatarInitial: {
    color: "#B8A3FF",
    fontSize: 22,
    fontWeight: "800",
  },
  avatarMeta: {
    flex: 1,
    gap: 2,
  },
  avatarName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  avatarRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  backText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  cardDesc: {
    color: "#8F8F8F",
    fontSize: 13,
    lineHeight: 19,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    gap: 18,
    paddingBottom: 48,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  dangerBtn: {
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 12,
  },
  dangerBtnText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
  },
  disabledInput: {
    color: "#8F8F8F",
    opacity: 0.7,
  },
  emailRow: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  emailValue: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#E5E5E5",
    fontSize: 12,
    fontWeight: "600",
  },
  header: {
    gap: 10,
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 12,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  input: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 10,
    borderWidth: 1,
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  layoutOption: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 12,
  },
  layoutOptionActive: {
    backgroundColor: "rgba(184, 163, 255, 0.1)",
    borderColor: "#B8A3FF",
  },
  layoutOptionDesc: {
    color: "#8F8F8F",
    fontSize: 11,
    lineHeight: 16,
  },
  layoutOptionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  layoutOptionTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  layoutOptionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  locationGrid: {
    flexDirection: "row",
    gap: 10,
  },
  noticeText: {
    color: "#B8A3FF",
    fontSize: 12,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.82,
  },
  primaryBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#B8A3FF",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#141417",
    borderColor: "#212121",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  subscriptionBox: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  subscriptionCopy: {
    gap: 3,
  },
  subscriptionDesc: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  subscriptionTier: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  switchLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  switchRowBorder: {
    borderTopColor: "#212121",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  switchSublabel: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  switchTextCol: {
    flex: 1,
    gap: 2,
    paddingRight: 14,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  titleTextCol: {
    flex: 1,
    gap: 2,
  },
});
