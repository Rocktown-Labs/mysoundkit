/* oxlint-disable one-var, sort-vars, no-nested-ternary */
/* eslint-disable one-var, sort-vars, no-nested-ternary */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCartPrice, useCart } from "@/contexts/cart-context";
import { API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export function CartModal() {
  const insets = useSafeAreaInsets(),
    router = useRouter(),
    { data: session } = authClient.useSession(),
    {
      cartOpen,
      clearCart,
      closeCart,
      isCartOpen,
      items,
      removeItem,
      totalCents,
      updateQuantity,
    } = useCart() as ReturnType<typeof useCart> & { cartOpen?: boolean },
    [isCheckingOut, setIsCheckingOut] = useState(false),
    [checkoutError, setCheckoutError] = useState<null | string>(null),
    isOpen = Boolean(isCartOpen ?? cartOpen),
    startCheckout = async () => {
      setCheckoutError(null);

      if (!session?.user) {
        closeCart();
        router.push("/login?redirect=/library/purchased");
        return;
      }

      setIsCheckingOut(true);

      try {
        const response = await authenticatedFetch(
            `${API_V1_URL}/payments/checkout`,
            {
              body: JSON.stringify({
                cancelUrl: "https://mysoundkit.com",
                idempotencyKey: `mobile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                successUrl: "https://mysoundkit.com/library/purchased",
              }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            }
          ),
          payload = (await response.json()) as {
            checkoutUrl?: null | string;
            message?: string;
          };

        if (!response.ok || !payload.checkoutUrl) {
          setIsCheckingOut(false);
          setCheckoutError(
            payload.message ?? "Checkout is not available for this cart yet."
          );
          return;
        }

        setIsCheckingOut(false);
        closeCart();
        void Linking.openURL(payload.checkoutUrl);
      } catch {
        setIsCheckingOut(false);
        setCheckoutError("Unable to start checkout right now.");
      }
    };

  return (
    <Modal
      animationType="slide"
      onRequestClose={closeCart}
      transparent
      visible={isOpen}
    >
      <View style={styles.scrim}>
        <Pressable
          accessibilityLabel="Close cart"
          accessibilityRole="button"
          onPress={closeCart}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerTitleRow}>
                <Ionicons color="#B8A3FF" name="bag-handle" size={18} />
                <Text style={styles.headerTitle}>Cart</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Review digital releases and beat licenses before checkout.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={8}
              onPress={closeCart}
              style={styles.closeBtn}
            >
              <Ionicons color="#8F8F8F" name="close" size={20} />
            </Pressable>
          </View>

          {/* Body */}
          {items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Ionicons color="#8F8F8F" name="bag-outline" size={36} />
              </View>
              <Text style={styles.emptyTitle}>Cart Empty</Text>
              <Text style={styles.emptySubtitle}>
                Add a track or license from a detail page.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.itemList}
              showsVerticalScrollIndicator={false}
            >
              {items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemCopy}>
                      <Text numberOfLines={1} style={styles.itemTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemBadge}>
                        {item.purchaseMode === "license"
                          ? "Beat License"
                          : item.purchaseMode === "physical_merch"
                            ? "Physical Merch"
                            : "Digital Download"}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`Remove ${item.title}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => removeItem(item.id)}
                      style={styles.trashBtn}
                    >
                      <Ionicons
                        color="#8F8F8F"
                        name="trash-outline"
                        size={16}
                      />
                    </Pressable>
                  </View>

                  <View style={styles.itemBottomRow}>
                    {/* Quantity Stepper */}
                    <View style={styles.stepper}>
                      <Pressable
                        accessibilityLabel="Decrease quantity"
                        accessibilityRole="button"
                        onPress={() =>
                          updateQuantity(
                            item.id,
                            Math.max(1, item.quantity - 1)
                          )
                        }
                        style={styles.stepperBtn}
                      >
                        <Ionicons color="#f4f4f5" name="remove" size={14} />
                      </Pressable>
                      <Text style={styles.stepperText}>{item.quantity}</Text>
                      <Pressable
                        accessibilityLabel="Increase quantity"
                        accessibilityRole="button"
                        onPress={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        style={styles.stepperBtn}
                      >
                        <Ionicons color="#f4f4f5" name="add" size={14} />
                      </Pressable>
                    </View>

                    <Text style={styles.itemPrice}>
                      {formatCartPrice(item.priceCents * item.quantity)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Footer */}
          {items.length > 0 ? (
            <View style={styles.footer}>
              {checkoutError ? (
                <View style={styles.errorBanner}>
                  <Ionicons color="#E05D4D" name="alert-circle" size={16} />
                  <Text style={styles.errorText}>{checkoutError}</Text>
                </View>
              ) : null}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL</Text>
                <Text style={styles.totalAmount}>
                  {formatCartPrice(totalCents)}
                </Text>
              </View>

              <Pressable
                accessibilityLabel="Checkout with Stripe"
                accessibilityRole="button"
                disabled={isCheckingOut}
                onPress={startCheckout}
                style={({ pressed }) => [
                  styles.checkoutBtn,
                  isCheckingOut && { opacity: 0.7 },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                {isCheckingOut ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <>
                    <Ionicons color="#000000" name="lock-closed" size={16} />
                    <Text style={styles.checkoutBtnText}>
                      Checkout with Stripe
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                accessibilityLabel="Clear cart"
                accessibilityRole="button"
                onPress={clearCart}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>Clear Cart</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  checkoutBtn: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
  },
  checkoutBtnText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
  clearBtn: {
    alignItems: "center",
    paddingVertical: 6,
  },
  clearBtnText: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  emptyIconCircle: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 999,
    height: 72,
    justifyContent: "center",
    marginBottom: 12,
    width: 72,
  },
  emptySubtitle: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  emptyWrap: {
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 56,
  },
  errorBanner: {
    alignItems: "center",
    backgroundColor: "rgba(224, 93, 77, 0.15)",
    borderColor: "rgba(224, 93, 77, 0.3)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    padding: 10,
  },
  errorText: {
    color: "#E05D4D",
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    borderTopColor: "#1e1e1e",
    borderTopWidth: 1,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    alignItems: "flex-start",
    borderBottomColor: "#1e1e1e",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  headerSubtitle: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  headerTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  itemBadge: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  itemBottomRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  itemList: {
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemPrice: {
    color: "#f4f4f5",
    fontSize: 15,
    fontWeight: "800",
  },
  itemRow: {
    backgroundColor: "#080808",
    borderColor: "#1e1e1e",
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  itemTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  itemTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scrim: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0d0d10",
    borderTopColor: "#222222",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: "85%",
  },
  stepper: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#222222",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
  },
  stepperBtn: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  stepperText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    width: 32,
  },
  totalAmount: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  totalLabel: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  totalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  trashBtn: {
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
});
