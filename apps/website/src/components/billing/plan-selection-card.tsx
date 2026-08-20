import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface BillingPlanOption {
  audience: "artist" | "fan";
  code: string;
  entitlements: Record<string, boolean | number | string>;
  maxSeats: number | null;
  monthlyPriceCents: number;
  name: string;
}

export function PlanSelectionCard({
  description,
  onSelect,
  plan,
  selected,
}: {
  description: string;
  onSelect: () => void;
  plan: BillingPlanOption;
  selected: boolean;
}) {
  const isPremium = plan.code.startsWith("soundkit_premium_");
  return (
    <div
      className={`relative w-full rounded-lg border-2 p-5 text-left transition ${selected ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/60"}`}
      onClick={onSelect}
    >
      <input
        aria-label={`Choose ${plan.name}`}
        checked={selected}
        className="sr-only"
        name="soundkit-plan"
        onChange={onSelect}
        type="radio"
        value={plan.code}
      />
      {isPremium ? (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
          <Sparkles className="size-3" /> Recommended
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">
            {plan.name.replace("SoundKit ", "")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="shrink-0 text-lg font-bold">
          {plan.monthlyPriceCents === 0
            ? "$0"
            : `$${(plan.monthlyPriceCents / 100).toFixed(2)}`}
          <span className="text-xs font-normal text-muted-foreground">/mo</span>
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="size-4 text-primary" />
        {plan.maxSeats ?? 1}{" "}
        {plan.maxSeats === 1 ? "account" : "accounts/seats"}
      </div>
      <Button
        className="mt-4 h-11 w-full"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        size="lg"
        variant={isPremium ? "default" : "outline"}
      >
        {isPremium ? "Choose Premium" : "Choose Free"}
      </Button>
    </div>
  );
}
