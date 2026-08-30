import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const EMPTY_FEATURES: string[] = [];

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
  features = EMPTY_FEATURES,
  onSelect,
  plan,
  selected,
}: {
  description: string;
  features?: string[];
  onSelect: () => void;
  plan: BillingPlanOption;
  selected: boolean;
}) {
  const isPremium = plan.code.startsWith("soundkit_premium_");
  return (
    <div
      aria-checked={selected}
      className={`relative min-w-0 w-full cursor-pointer rounded-lg border-2 p-5 text-left transition ${selected ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/60"}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="radio"
      tabIndex={0}
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
      {features.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-border/60 pt-4 text-sm">
          {features.map((feature) => (
            <li className="flex items-start gap-2" key={feature}>
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        className="mt-4 h-11 w-full px-2 text-xs sm:px-4 sm:text-sm"
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
