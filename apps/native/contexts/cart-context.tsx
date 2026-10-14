/* oxlint-disable one-var, sort-vars, react/preserve-manual-memoization */
/* eslint-disable one-var, sort-vars, react/preserve-manual-memoization */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export interface CartItem {
  artistName?: string;
  coverArtUrl?: null | string;
  id: string;
  priceCents: number;
  purchaseMode?: "digital_release" | "license" | "physical_merch";
  quantity: number;
  title: string;
}

export interface CartContextValue {
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  clearCart: () => void;
  closeCart: () => void;
  isCartOpen: boolean;
  itemCount: number;
  items: CartItem[];
  openCart: () => void;
  removeItem: (id: string) => void;
  setIsCartOpen: (open: boolean) => void;
  totalCents: number;
  updateQuantity: (id: string, qty: number) => void;
}

const CART_STORAGE_KEY = "@soundkit/shopping_cart_v1",
  CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]),
    [isCartOpen, setIsCartOpen] = useState(false),
    [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as CartItem[];
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        }
        setIsInitialized(true);
      } catch {
        // Fallback default
        setIsInitialized(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      void AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isInitialized]);

  const addItem = useCallback(
      (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
        setItems((prev) => {
          const existingIndex = prev.findIndex((i) => i.id === item.id),
            qtyToAdd = item.quantity ?? 1;
          if (existingIndex !== -1) {
            const copy = [...prev],
              existing = copy[existingIndex];
            if (existing) {
              copy[existingIndex] = {
                ...existing,
                quantity: existing.quantity + qtyToAdd,
              };
            }
            return copy;
          }
          return [...prev, { ...item, quantity: qtyToAdd }];
        });
        setIsCartOpen(true);
      },
      []
    ),
    removeItem = useCallback((id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, []),
    updateQuantity = useCallback((id: string, qty: number) => {
      if (qty <= 0) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i))
      );
    }, []),
    clearCart = useCallback(() => {
      setItems([]);
    }, []),
    openCart = useCallback(() => {
      setIsCartOpen(true);
    }, []),
    closeCart = useCallback(() => {
      setIsCartOpen(false);
    }, []),
    totalCents = useMemo(
      () =>
        items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
      [items]
    ),
    itemCount = useMemo(
      () => items.reduce((sum, item) => sum + item.quantity, 0),
      [items]
    ),
    value = useMemo<CartContextValue>(
      () => ({
        addItem,
        clearCart,
        closeCart,
        isCartOpen,
        itemCount,
        items,
        openCart,
        removeItem,
        setIsCartOpen,
        totalCents,
        updateQuantity,
      }),
      [
        addItem,
        clearCart,
        closeCart,
        isCartOpen,
        itemCount,
        items,
        openCart,
        removeItem,
        totalCents,
        updateQuantity,
      ]
    );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export function formatCartPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
