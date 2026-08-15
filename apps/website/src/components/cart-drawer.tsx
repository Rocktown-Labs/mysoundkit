"use client";

/* eslint-disable react-perf/jsx-no-new-function-as-prop */
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";

import { formatCartPrice, useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { API_V1_URL } from "@/lib/api";

export function CartDrawer() {
  const [checkoutError, setCheckoutError] = useState<string | null>(null),
   [isCheckingOut, setIsCheckingOut] = useState(false),
   {
    cart,
    clearCart,
    isCartOpen,
    removeItem,
    setIsCartOpen,
    updateQuantity,
  } = useCart(),

   startCheckout = async () => {
    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const response = await fetch(`${API_V1_URL}/payments/checkout`, {
        body: JSON.stringify({
          cancelUrl: window.location.href,
          successUrl: `${window.location.origin}/library/purchased`,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
       payload = (await response.json()) as {
        checkoutUrl?: string | null;
        message?: string;
      };

      if (!response.ok || !payload.checkoutUrl) {
        setCheckoutError(
          payload.message ?? "Checkout is not available for this cart yet."
        );
        return;
      }

      window.location.assign(payload.checkoutUrl);
    } catch {
      setCheckoutError("Unable to start checkout right now.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="flex w-full flex-col gap-6 border-border/40 bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/40 px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em]">
            <ShoppingCart className="size-4" />
            Cart
          </SheetTitle>
          <SheetDescription>
            Review digital releases and beat licenses before checkout.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-6">
          {cart.items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <ShoppingCart className="size-10 text-muted-foreground" />
              <div>
                <p className="font-black uppercase tracking-[0.16em]">
                  Cart Empty
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a track or license from a detail page.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/30">
              {cart.items.map((item) => (
                <div key={item.id} className="flex flex-col gap-4 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black uppercase tracking-tight">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        {item.purchaseMode === "license"
                          ? (item.licenseName ?? "Beat License")
                          : "Digital Download"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove {item.title}</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center border border-border/40">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-none"
                        onClick={() =>
                          updateQuantity(
                            item.id,
                            Math.max(1, item.quantity - 1)
                          )
                        }
                      >
                        <Minus className="size-3" />
                        <span className="sr-only">Decrease quantity</span>
                      </Button>
                      <span className="w-10 text-center text-sm font-black tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-none"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                      >
                        <Plus className="size-3" />
                        <span className="sr-only">Increase quantity</span>
                      </Button>
                    </div>
                    <p className="text-sm font-black tabular-nums">
                      {formatCartPrice(item.priceCents * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/40 p-6">
          {checkoutError ? (
            <p className="mb-4 text-sm text-destructive">{checkoutError}</p>
          ) : null}
          <div className="mb-5 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              Total
            </p>
            <p className="text-2xl font-black tabular-nums">
              {formatCartPrice(cart.totalCents)}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-none"
              onClick={clearCart}
              disabled={cart.items.length === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-none font-black uppercase tracking-[0.14em]"
              disabled={cart.items.length === 0 || isCheckingOut}
              onClick={() => void startCheckout()}
            >
              {isCheckingOut ? "Starting..." : "Checkout"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
