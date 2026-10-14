import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useCart } from "@/contexts/cart-context";

export function CartHeaderButton() {
  const { itemCount, openCart } = useCart();

  return (
    <Pressable
      accessibilityHint="Opens shopping cart"
      accessibilityLabel={`Cart, ${itemCount} items`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={openCart}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? "#212121" : "#111111",
          borderColor: "#212121",
        },
      ]}
    >
      <Ionicons color="#f4f4f5" name="bag-handle-outline" size={18} />
      {itemCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {itemCount > 9 ? "9+" : itemCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    height: 16,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: 4,
    position: "absolute",
    right: -4,
    top: -4,
  },
  badgeText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "900",
  },
  button: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    position: "relative",
    width: 40,
  },
});
