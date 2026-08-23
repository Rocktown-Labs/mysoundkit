import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExploreCollectionSearch {
  genre?: string;
  q?: string;
  region?: string;
  regionType?: "north-america" | "global";
  sort?: string;
  view?: "all" | "sections";
}

type ExploreCollectionLayout = "default" | "landscape";

interface ExploreCollectionSectionProps<T> {
  children: (item: T) => ReactNode;
  description?: string;
  empty: ReactNode;
  isLoading?: boolean;
  items: T[];
  layout?: ExploreCollectionLayout;
  onViewAll?: () => void;
  title: string;
}

export function ExploreCollectionSection<T>({
  children,
  description,
  empty,
  isLoading = false,
  items,
  layout = "default",
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
        <div className={collectionGridClassName(layout)}>
          {items.slice(0, layout === "landscape" ? 8 : 6).map((item, index) => (
            <div className="min-w-0" key={getItemKey(item, index)}>
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
  footer?: ReactNode;
  isLoading?: boolean;
  items: T[];
  layout?: ExploreCollectionLayout;
  title: string;
}

export function ExploreCollectionGrid<T>({
  children,
  empty,
  footer,
  isLoading = false,
  items,
  layout = "default",
  title,
}: ExploreCollectionGridProps<T>) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-semibold text-xl">{title}</h2>
      {isLoading || items.length > 0 ? (
        <>
          <div className={collectionGridClassName(layout)}>
            {items.map((item, index) => (
              <div className="min-w-0" key={getItemKey(item, index)}>
                {children(item)}
              </div>
            ))}
          </div>
          {footer}
        </>
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

const collectionGridClassName = (layout: ExploreCollectionLayout) =>
    cn(
      "grid gap-3 md:gap-4",
      layout === "landscape"
        ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    ),
  getItemKey = <T,>(item: T, index: number) => {
    if (typeof item === "object" && item !== null && "id" in item) {
      const { id } = item;
      if (typeof id === "string" || typeof id === "number") {
        return id;
      }
    }

    return index;
  };
