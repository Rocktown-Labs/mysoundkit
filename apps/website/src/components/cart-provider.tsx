"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { API_V1_URL } from "@/lib/api";

type ProductType = "track" | "project";
type PurchaseMode = "digital_download" | "license";

export interface CartItem {
  artistName?: string | null;
  coverArtUrl?: string | null;
  currency: string;
  id: string;
  licenseName?: string | null;
  licenseOptionId?: string | null;
  priceCents: number;
  productId: string;
  productType: ProductType;
  purchaseMode: PurchaseMode;
  quantity: number;
  title: string;
  trackId?: string | null;
}

export interface Cart {
  currency: string;
  id: string | null;
  itemCount: number;
  items: CartItem[];
  subtotalCents: number;
  totalCents: number;
}

export interface AddCartItemInput {
  artistName?: string | null;
  coverArtUrl?: string | null;
  licenseName?: string | null;
  licenseOptionId?: string;
  priceCents: number;
  productType: ProductType;
  projectId?: string;
  purchaseMode: PurchaseMode;
  quantity?: number;
  title: string;
  trackId?: string;
}

interface CartContextValue {
  addItem: (input: AddCartItemInput) => Promise<void>;
  cart: Cart;
  clearCart: () => Promise<void>;
  isCartOpen: boolean;
  removeItem: (cartItemId: string) => Promise<void>;
  setIsCartOpen: (isOpen: boolean) => void;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
}

const EMPTY_CART: Cart = {
  currency: "USD",
  id: null,
  itemCount: 0,
  items: [],
  subtotalCents: 0,
  totalCents: 0,
};

const LOCAL_CART_STORAGE_KEY = "soundkit:cart:v1";

const CartContext = createContext<CartContextValue | null>(null);

const calculateCart = (items: CartItem[]): Cart => {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0
  );

  return {
    currency: "USD",
    id: null,
    itemCount,
    items,
    subtotalCents,
    totalCents: subtotalCents,
  };
};

const readLocalCart = () => {
  if (typeof window === "undefined") {
    return EMPTY_CART;
  }

  const rawValue = window.localStorage.getItem(LOCAL_CART_STORAGE_KEY);

  if (!rawValue) {
    return EMPTY_CART;
  }

  try {
    const items = JSON.parse(rawValue) as CartItem[];
    return calculateCart(Array.isArray(items) ? items : []);
  } catch {
    return EMPTY_CART;
  }
};

const writeLocalCart = (items: CartItem[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_CART_STORAGE_KEY, JSON.stringify(items));
};

const requestCart = async (path = "", init?: RequestInit) => {
  const response = await fetch(`${API_V1_URL}/cart${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Cart request failed with ${response.status}`);
  }

  return (await response.json()) as Cart;
};

const buildLocalCartItem = (input: AddCartItemInput): CartItem => {
  const productId = input.trackId ?? input.projectId ?? crypto.randomUUID();

  return {
    artistName: input.artistName,
    coverArtUrl: input.coverArtUrl,
    currency: "USD",
    id: crypto.randomUUID(),
    licenseName: input.licenseName,
    licenseOptionId: input.licenseOptionId,
    priceCents: input.priceCents,
    productId,
    productType: input.productType,
    purchaseMode: input.purchaseMode,
    quantity: input.quantity ?? 1,
    title: input.title,
    trackId: input.trackId,
  };
};

export function CartProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [isApiCartActive, setIsApiCartActive] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    setCart(readLocalCart());
  }, []);

  const setLocalItems = useCallback((items: CartItem[]) => {
    writeLocalCart(items);
    setCart(calculateCart(items));
  }, []);

  const addItem = useCallback(
    async (input: AddCartItemInput) => {
      if (isApiCartActive) {
        try {
          const apiCart = await requestCart("/items", {
            body: JSON.stringify({
              licenseOptionId: input.licenseOptionId,
              productType: input.productType,
              projectId: input.projectId,
              quantity: input.quantity ?? 1,
              trackId: input.trackId,
            }),
            method: "POST",
          });
          setCart(apiCart);
          setIsCartOpen(true);
          return;
        } catch {
          setIsApiCartActive(false);
        }
      }

      const nextItem = buildLocalCartItem(input);
      const existingItem = cart.items.find(
        (item) =>
          item.productType === nextItem.productType &&
          item.productId === nextItem.productId &&
          item.licenseOptionId === nextItem.licenseOptionId
      );
      const nextItems = existingItem
        ? cart.items.map((item) =>
            item.id === existingItem.id
              ? { ...item, quantity: item.quantity + nextItem.quantity }
              : item
          )
        : [...cart.items, nextItem];

      setLocalItems(nextItems);
      setIsCartOpen(true);
    },
    [cart.items, isApiCartActive, setLocalItems]
  );

  const updateQuantity = useCallback(
    async (cartItemId: string, quantity: number) => {
      if (quantity < 1) {
        return;
      }

      if (isApiCartActive) {
        try {
          const apiCart = await requestCart(`/items/${cartItemId}`, {
            body: JSON.stringify({ quantity }),
            method: "PATCH",
          });
          setCart(apiCart);
          return;
        } catch {
          setIsApiCartActive(false);
        }
      }

      setLocalItems(
        cart.items.map((item) =>
          item.id === cartItemId ? { ...item, quantity } : item
        )
      );
    },
    [cart.items, isApiCartActive, setLocalItems]
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      if (isApiCartActive) {
        try {
          const apiCart = await requestCart(`/items/${cartItemId}`, {
            method: "DELETE",
          });
          setCart(apiCart);
          return;
        } catch {
          setIsApiCartActive(false);
        }
      }

      setLocalItems(cart.items.filter((item) => item.id !== cartItemId));
    },
    [cart.items, isApiCartActive, setLocalItems]
  );

  const clearCart = useCallback(async () => {
    if (isApiCartActive) {
      try {
        const apiCart = await requestCart("", { method: "DELETE" });
        setCart(apiCart);
        return;
      } catch {
        setIsApiCartActive(false);
      }
    }

    setLocalItems([]);
  }, [isApiCartActive, setLocalItems]);

  const value = useMemo(
    () => ({
      addItem,
      cart,
      clearCart,
      isCartOpen,
      removeItem,
      setIsCartOpen,
      updateQuantity,
    }),
    [
      addItem,
      cart,
      clearCart,
      isCartOpen,
      removeItem,
      setIsCartOpen,
      updateQuantity,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const value = useContext(CartContext);

  if (!value) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return value;
};

export const formatCartPrice = (priceCents: number) =>
  `$${(priceCents / 100).toFixed(2)}`;
