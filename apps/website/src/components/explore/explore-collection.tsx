import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export interface ExploreCollectionSearch {
  genre?: string;
  q?: string;
  region?: string;
  regionType?: "north-america" | "global";
  sort?: string;
  view?: "all" | "sections";
}

interface ExploreCollectionSectionProps<T> {
  children: (item: T) => ReactNode;
  empty: ReactNode;
  isLoading?: boolean;
  items: T[];
  title: string;
  description?: string;
  onViewAll?: () => void;
}

export function ExploreCollectionSection<T>({
  children,
  description,
  empty,
  isLoading = false,
  items,
  onViewAll,
  title,
}: ExploreCollectionSectionProps<T>) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-xl">{title}</h2>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {onViewAll ? (
          <Button onClick={onViewAll} size="sm" variant="ghost">
            View All
          </Button>
        ) : null}
      </div>
      {isLoading || items.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {items.map((item, index) => (
            <div className="shrink-0" key={getItemKey(item, index)}>
              {children(item)}
            </div>
          ))}
        </div>
      ) : (
        <ExploreCollectionEmpty>{empty}</ExploreCollectionEmpty>
      )}
    </section>
  );
}

interface ExploreCollectionGridProps<T> {
  children: (item: T) => ReactNode;
  empty: ReactNode;
  isLoading?: boolean;
  items: T[];
  title: string;
}

export function ExploreCollectionGrid<T>({
  children,
  empty,
  isLoading = false,
  items,
  title,
}: ExploreCollectionGridProps<T>) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-semibold text-xl">{title}</h2>
      {isLoading || items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => (
            <div key={getItemKey(item, index)}>{children(item)}</div>
          ))}
        </div>
      ) : (
        <ExploreCollectionEmpty>{empty}</ExploreCollectionEmpty>
      )}
    </section>
  );
}

export function ExploreCollectionEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
      {children}
    </div>
  );
}

const getItemKey = <T,>(item: T, index: number) => {
  if (typeof item === "object" && item !== null && "id" in item) {
    const {id} = item;
    if (typeof id === "string" || typeof id === "number") {
      return id;
    }
  }

  return index;
};
