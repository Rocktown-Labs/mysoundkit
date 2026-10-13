import { Check, ExternalLink, Plus, RefreshCw, Search } from "lucide-react";
/* eslint-disable sort-vars, one-var */
import { useState } from "react";
import type { ReactNode } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  useAdminMerchCatalogQuery,
  useEnableMerchProductMutation,
  useRefreshMerchProductMutation,
  useSearchPrintfulProductsMutation,
  useUpdateMerchProductMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  AdminMerchCatalogItem,
  AdminPrintfulProduct,
} from "@/lib/soundkit-api-hooks";

const failureMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Printful request failed.",
  formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function MerchCatalogPanel() {
  const [boundsDrafts, setBoundsDrafts] = useState<
      Record<string, { max: string; min: string }>
    >({}),
    [enablingId, setEnablingId] = useState<number | null>(null),
    [savingBoundsId, setSavingBoundsId] = useState<string | null>(null),
    [searchResults, setSearchResults] = useState<AdminPrintfulProduct[]>([]),
    [searchText, setSearchText] = useState(""),
    { data: catalog = [], isLoading } = useAdminMerchCatalogQuery(),
    enableProduct = useEnableMerchProductMutation(),
    refreshProduct = useRefreshMerchProductMutation(),
    searchPrintful = useSearchPrintfulProductsMutation(),
    updateProduct = useUpdateMerchProductMutation(),
    runSearch = () =>
      searchPrintful.mutate(searchText.trim(), {
        onError: (error) => {
          toast({
            description: failureMessage(error),
            title: "Printful search failed",
            variant: "destructive",
          });
        },
        onSuccess: (results) => {
          setSearchResults(results);

          if (results.length === 0) {
            toast({
              description: "No Printful products matched that search.",
              title: "No results",
            });
          }
        },
      }),
    runEnable = (printfulProductId: number) => {
      setEnablingId(printfulProductId);
      enableProduct.mutate(
        { printfulProductId },
        {
          onError: (error) => {
            toast({
              description: failureMessage(error),
              title: "Enable failed",
              variant: "destructive",
            });
          },
          onSettled: () => setEnablingId(null),
          onSuccess: () => {
            toast({
              description: `Enabled Printful product ${printfulProductId} with default retail bounds.`,
              title: "Merch blank enabled",
            });
          },
        }
      );
    },
    runToggle = (item: AdminMerchCatalogItem) =>
      updateProduct.mutate(
        { curated: !item.isCurated, id: item.id },
        {
          onError: (error) => {
            toast({
              description: failureMessage(error),
              title: "Update failed",
              variant: "destructive",
            });
          },
          onSuccess: () => {
            toast({
              description: `${item.name} is ${item.isCurated ? "hidden from the merch studio" : "available in the merch studio"}.`,
              title: item.isCurated ? "Blank disabled" : "Blank enabled",
            });
          },
        }
      ),
    runRefresh = (item: AdminMerchCatalogItem) =>
      refreshProduct.mutate(item.id, {
        onError: (error) => {
          toast({
            description: failureMessage(error),
            title: "Refresh failed",
            variant: "destructive",
          });
        },
        onSuccess: () => {
          toast({
            description: `Refreshed ${item.name} from Printful.`,
            title: "Blank refreshed",
          });
        },
      }),
    runSaveBounds = (item: AdminMerchCatalogItem) => {
      const draft = boundsDrafts[item.id];

      if (!draft) {
        return;
      }

      const min = Math.round(Number(draft.min) * 100),
        max = Math.round(Number(draft.max) * 100);

      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min < 1200 ||
        max <= min
      ) {
        toast({
          description:
            "Minimum must be at least $12.00 and the maximum must be above it.",
          title: "Invalid bounds",
          variant: "destructive",
        });
        return;
      }

      setSavingBoundsId(item.id);
      updateProduct.mutate(
        { id: item.id, retailMaxCents: max, retailMinCents: min },
        {
          onError: (error) => {
            toast({
              description: failureMessage(error),
              title: "Update failed",
              variant: "destructive",
            });
          },
          onSettled: () => setSavingBoundsId(null),
          onSuccess: () => {
            setBoundsDrafts((drafts) =>
              Object.fromEntries(
                Object.entries(drafts).filter(([key]) => key !== item.id)
              )
            );
            toast({
              description: `Retail bounds updated for ${item.name}.`,
              title: "Bounds saved",
            });
          },
        }
      );
    };

  let catalogContent: ReactNode = null;

  if (isLoading) {
    catalogContent = (
      <p className="text-muted-foreground text-sm">Loading catalog…</p>
    );
  } else if (catalog.length === 0) {
    catalogContent = (
      <p className="text-muted-foreground text-sm">
        No Printful blanks are synced yet — enable one above.
      </p>
    );
  } else {
    catalogContent = (
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Blank</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Retail bounds (min / max)</TableHead>
              <TableHead>Synced</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalog.map((item) => {
              const draft = boundsDrafts[item.id],
                min = draft?.min ?? (item.retailMinCents / 100).toFixed(2),
                max = draft?.max ?? (item.retailMaxCents / 100).toFixed(2);

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <AppImage
                          alt={item.name}
                          className="size-10 shrink-0 rounded-md border border-border/40 object-cover"
                          height={80}
                          src={item.image}
                          width={80}
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md text-[10px]">
                          N/A
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {item.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          #{item.id}
                          {item.brand ? ` · ${item.brand}` : ""}
                        </p>
                      </div>
                      {item.isDiscontinued ? (
                        <Badge className="h-5" variant="destructive">
                          Discontinued
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {item.inStockCount}/{item.variantCount}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {item.minBasePriceCents > 0
                      ? formatCents(item.minBasePriceCents)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <div>
                        <Label className="sr-only" htmlFor={`min-${item.id}`}>
                          Retail minimum for {item.name}
                        </Label>
                        <Input
                          className="h-8 w-20"
                          id={`min-${item.id}`}
                          inputMode="decimal"
                          onChange={(event) =>
                            setBoundsDrafts((drafts) => ({
                              ...drafts,
                              [item.id]: { max, min: event.target.value },
                            }))
                          }
                          type="number"
                          value={min}
                        />
                      </div>
                      <span className="text-muted-foreground">/</span>
                      <div>
                        <Label className="sr-only" htmlFor={`max-${item.id}`}>
                          Retail maximum for {item.name}
                        </Label>
                        <Input
                          className="h-8 w-20"
                          id={`max-${item.id}`}
                          inputMode="decimal"
                          onChange={(event) =>
                            setBoundsDrafts((drafts) => ({
                              ...drafts,
                              [item.id]: { max: event.target.value, min },
                            }))
                          }
                          type="number"
                          value={max}
                        />
                      </div>
                      {draft ? (
                        <Button
                          aria-label={`Save bounds for ${item.name}`}
                          disabled={savingBoundsId === item.id}
                          onClick={() => runSaveBounds(item)}
                          size="icon"
                          variant="ghost"
                        >
                          <Check className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(item.syncedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        onClick={() => runToggle(item)}
                        size="sm"
                        variant={item.isCurated ? "default" : "outline"}
                      >
                        {item.isCurated ? "Enabled" : "Disabled"}
                      </Button>
                      <Button
                        aria-label={`Refresh ${item.name}`}
                        onClick={() => runRefresh(item)}
                        size="icon"
                        variant="ghost"
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-black uppercase tracking-tight">
              Enable Printful blanks
            </h3>
            <p className="text-muted-foreground text-xs">
              Search Printful&apos;s catalog and enable blanks on demand. Retail
              bounds default from base costs and stay editable below.
            </p>
          </div>
          <a
            className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:text-foreground"
            href="https://developers.printful.com/docs/"
            rel="noopener noreferrer"
            target="_blank"
          >
            Printful catalog docs <ExternalLink className="size-3" />
          </a>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <Input
            aria-label="Search Printful products"
            onChange={(event) => setSearchText(event.target.value)}
            placeholder='e.g. "hoodie", "Bella + Canvas 3001"'
            value={searchText}
          />
          <Button
            disabled={
              searchPrintful.isPending || searchText.trim().length === 0
            }
            type="submit"
          >
            <Search className="size-4" />
            {searchPrintful.isPending ? "Searching…" : "Search"}
          </Button>
        </form>
        {searchResults.length > 0 ? (
          <div className="divide-y divide-border/30 overflow-hidden rounded-lg border border-border/40">
            {searchResults.map((result) => (
              <div
                className="flex items-center justify-between gap-3 p-3"
                key={result.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {result.image ? (
                    <AppImage
                      alt={result.name}
                      className="size-10 shrink-0 rounded-md border border-border/40 object-cover"
                      height={80}
                      src={result.image}
                      width={80}
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md text-[10px]">
                      N/A
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {result.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      #{result.id}
                      {result.type ? ` · ${result.type}` : ""}
                      {typeof result.variantCount === "number"
                        ? ` · ${result.variantCount} variants`
                        : ""}
                    </p>
                  </div>
                </div>
                <Button
                  disabled={enablingId === result.id}
                  onClick={() => runEnable(result.id)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="size-4" />
                  {enablingId === result.id ? "Enabling…" : "Enable"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="font-black uppercase tracking-tight">
          Curated catalog ({catalog.length})
        </h3>
        {catalogContent}
      </section>
    </div>
  );
}

export { MerchCatalogPanel };
