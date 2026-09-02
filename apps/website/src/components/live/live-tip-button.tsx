"use client";
/* eslint-disable complexity, no-nested-ternary, one-var, sort-vars */

import { env } from "@soundkit/env/web";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Link } from "@tanstack/react-router";
import { HandCoins } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SoundKitApiError } from "@/lib/api";
import { useTipCheckoutMutation } from "@/lib/soundkit-api-hooks";
import type { LiveTipKind } from "@/lib/soundkit-api-hooks";

const PRESET_AMOUNTS_CENTS = [500, 1000, 1500, 2000] as const,
  MAX_TIP_CENTS = 100_000,
  MIN_TIP_CENTS = 100,
  stripePromise = env.VITE_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY)
    : null,
  formatDollars = (amountCents: number) => `$${(amountCents / 100).toFixed(2)}`,
  currencyAmountPattern = /^\d+(?:\.\d{1,2})?$/u;

export interface LiveTipRecipient {
  avatarUrl?: string | null;
  id: string;
  name: string;
}

interface LiveTipButtonProps {
  isLive: boolean;
  kind: LiveTipKind;
  liveExperienceId: string;
  recipients: LiveTipRecipient[];
}

type BattleRecipientChoice = "artist_a" | "artist_b" | "both";

const getTipRecipientIds = ({
  choice,
  isBattle,
  recipients,
}: {
  choice: BattleRecipientChoice;
  isBattle: boolean;
  recipients: LiveTipRecipient[];
}) => {
  if (!isBattle) {
    return [recipients[0]?.id ?? ""];
  }

  if (choice === "both") {
    return recipients.map((recipient) => recipient.id);
  }

  const recipient = choice === "artist_a" ? recipients[0] : recipients[1];
  return [recipient?.id ?? ""];
};

const getTipError = (error: unknown) => {
  if (error instanceof SoundKitApiError && error.status === 401) {
    return { message: "Sign in to send a tip.", requiresAuth: true };
  }

  return {
    message:
      error instanceof Error ? error.message : "Unable to start tip checkout.",
    requiresAuth: false,
  };
};

export function LiveTipButton({
  isLive,
  kind,
  liveExperienceId,
  recipients,
}: LiveTipButtonProps) {
  const [isOpen, setIsOpen] = useState(false),
    [customAmount, setCustomAmount] = useState("10.00"),
    [selectedPreset, setSelectedPreset] = useState<number | null>(1000),
    [message, setMessage] = useState(""),
    [recipientChoice, setRecipientChoice] =
      useState<BattleRecipientChoice>("both"),
    [clientSecret, setClientSecret] = useState<string | null>(null),
    [idempotencyKey, setIdempotencyKey] = useState<string | null>(null),
    [formError, setFormError] = useState<string | null>(null),
    [authRequired, setAuthRequired] = useState(false),
    tipCheckout = useTipCheckoutMutation(),
    checkoutOptions = useMemo(
      () => (clientSecret ? { clientSecret } : null),
      [clientSecret]
    );

  if (!isLive || recipients.length === 0) {
    return null;
  }

  const isBattle = kind === "battle" && recipients.length === 2,
    selectedRecipientIds = getTipRecipientIds({
      choice: recipientChoice,
      isBattle,
      recipients,
    }),
    amountCents = selectedPreset ?? Math.round(Number(customAmount) * 100),
    amountIsValid =
      (selectedPreset !== null ||
        currencyAmountPattern.test(customAmount.trim())) &&
      Number.isInteger(amountCents) &&
      amountCents >= MIN_TIP_CENTS &&
      amountCents <= MAX_TIP_CENTS,
    handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setClientSecret(null);
        setIdempotencyKey(null);
        setFormError(null);
        setAuthRequired(false);
        tipCheckout.reset();
      }
    },
    handlePresetClick = (presetCents: number) => {
      setSelectedPreset(presetCents);
      setCustomAmount((presetCents / 100).toFixed(2));
      setIdempotencyKey(null);
      setFormError(null);
    },
    handleCustomAmountChange = (value: string) => {
      setSelectedPreset(null);
      setCustomAmount(value);
      setIdempotencyKey(null);
      setFormError(null);
    },
    handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!amountIsValid) {
        setFormError("Enter an amount between $1.00 and $1,000.00.");
        return;
      }

      if (selectedRecipientIds.some((id) => !id)) {
        setFormError("Choose a valid tip recipient.");
        return;
      }

      const checkoutIdempotencyKey = idempotencyKey ?? crypto.randomUUID();
      setIdempotencyKey(checkoutIdempotencyKey);
      setFormError(null);
      setAuthRequired(false);
      tipCheckout.mutate(
        {
          amountCents,
          cancelUrl: window.location.href,
          idempotencyKey: checkoutIdempotencyKey,
          liveExperienceId,
          liveKind: kind,
          message: message.trim() || undefined,
          recipientUserIds: selectedRecipientIds,
          successUrl: window.location.href,
        },
        {
          onError: (error) => {
            const tipError = getTipError(error);
            setAuthRequired(tipError.requiresAuth);
            setFormError(tipError.message);
            setIdempotencyKey(null);
          },
          onSuccess: (response) => {
            if (response.clientSecret) {
              setClientSecret(response.clientSecret);
              return;
            }

            setIdempotencyKey(null);
            setFormError(
              response.setupRequired
                ? "Tips are temporarily unavailable."
                : "Stripe checkout could not be started."
            );
          },
        }
      );
    };

  return (
    <>
      <Button
        className="gap-1.5"
        onClick={() => setIsOpen(true)}
        size="sm"
        type="button"
        variant="default"
      >
        <HandCoins className="size-3.5" />
        Tip
      </Button>

      <Dialog onOpenChange={handleOpenChange} open={isOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {isBattle ? "Support the battle" : "Support the live creator"}
            </DialogTitle>
            <DialogDescription>
              Send {isBattle ? "the artists" : "the creator"} a tip without
              leaving this live event.
            </DialogDescription>
          </DialogHeader>

          {clientSecret && stripePromise && checkoutOptions ? (
            <div className="min-h-[540px] overflow-hidden rounded-lg border bg-white">
              <EmbeddedCheckoutProvider
                options={checkoutOptions}
                stripe={stripePromise}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <fieldset className="space-y-3">
                <legend className="font-semibold text-sm">Tip amount</legend>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS_CENTS.map((presetCents) => (
                    <Button
                      className="h-10"
                      key={presetCents}
                      onClick={() => handlePresetClick(presetCents)}
                      type="button"
                      variant={
                        selectedPreset === presetCents ? "default" : "outline"
                      }
                    >
                      {formatDollars(presetCents)}
                    </Button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-tip-amount">Custom amount</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      aria-label="Custom tip amount"
                      className="pl-7"
                      id="custom-tip-amount"
                      inputMode="decimal"
                      min="1"
                      onChange={(event) =>
                        handleCustomAmountChange(event.target.value)
                      }
                      placeholder="10.00"
                      step="0.01"
                      type="number"
                      value={customAmount}
                    />
                  </div>
                </div>
              </fieldset>

              {isBattle ? (
                <fieldset className="space-y-3">
                  <legend className="font-semibold text-sm">
                    Tip recipient
                  </legend>
                  <RadioGroup
                    onValueChange={(value) => {
                      setRecipientChoice(value as BattleRecipientChoice);
                      setIdempotencyKey(null);
                    }}
                    value={recipientChoice}
                  >
                    <Label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent">
                      <RadioGroupItem value="artist_a" />
                      <span>{recipients[0]?.name ?? "Artist A"}</span>
                    </Label>
                    <Label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent">
                      <RadioGroupItem value="artist_b" />
                      <span>{recipients[1]?.name ?? "Artist B"}</span>
                    </Label>
                    <Label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent">
                      <RadioGroupItem value="both" />
                      <span>Both artists — split 50/50</span>
                    </Label>
                  </RadioGroup>
                </fieldset>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="tip-message">Message (optional)</Label>
                <Input
                  id="tip-message"
                  maxLength={500}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setIdempotencyKey(null);
                  }}
                  placeholder="Keep creating!"
                  value={message}
                />
              </div>

              {formError ? (
                <p className="text-destructive text-sm" role="alert">
                  {formError}{" "}
                  {authRequired ? (
                    <Link
                      className="font-medium underline"
                      search={{ redirect: "/live" }}
                      to="/login"
                    >
                      Sign in
                    </Link>
                  ) : null}
                </p>
              ) : null}

              <Button
                className="w-full"
                disabled={tipCheckout.isPending || !stripePromise}
                type="submit"
              >
                {tipCheckout.isPending
                  ? "Preparing secure checkout..."
                  : `Continue with ${formatDollars(amountCents || 0)} tip`}
              </Button>
              {stripePromise ? null : (
                <p className="text-center text-muted-foreground text-xs">
                  Tip checkout is not configured in this environment.
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
