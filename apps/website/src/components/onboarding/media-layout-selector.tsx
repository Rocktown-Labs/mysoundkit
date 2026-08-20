import { List, PanelsTopLeft } from "lucide-react";
import type { ReactNode } from "react";

export function MediaLayoutSelector({
  onChange,
  value,
}: {
  onChange: (value: "cards" | "list") => void;
  value: "cards" | "list";
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Media layout</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <LayoutOption
          description="Best for artwork-forward browsing."
          icon={<PanelsTopLeft className="size-5" />}
          label="Visual cards"
          onClick={() => onChange("cards")}
          selected={value === "cards"}
        />
        <LayoutOption
          description="Best for a denser library/catalog view."
          icon={<List className="size-5" />}
          label="Compact list"
          onClick={() => onChange("list")}
          selected={value === "list"}
        />
      </div>
    </fieldset>
  );
}

function LayoutOption({
  description,
  icon,
  label,
  onClick,
  selected,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-checked={selected}
      className={`min-h-32 rounded-lg border-2 p-4 text-left transition ${selected ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/60"}`}
      onClick={onClick}
      role="radio"
      type="button"
    >
      <div className="mb-4 flex items-center gap-2 text-primary">{icon}</div>
      <div className="font-semibold">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}
