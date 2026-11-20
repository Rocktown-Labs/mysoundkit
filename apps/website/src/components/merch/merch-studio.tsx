/* eslint-disable one-var, sort-vars -- Keep derived values beside the hooks they depend on. */
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Download,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Shirt,
} from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useDeleteMerchDesignMutation,
  useMerchCatalogQuery,
  useMerchDesignMockupsQuery,
  useMerchDesignsQuery,
  usePhysicalReleasesQuery,
  useUpdateMerchDesignMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  MerchDesign,
  PhysicalReleaseCard,
} from "@/lib/soundkit-api-hooks";

import { MerchCatalog, merchPrice } from "./merch-catalog";
import { MerchDesigner } from "./merch-designer";
import { MerchDiscardDialog } from "./merch-discard-dialog";

const MEDIA_FORMAT_LABELS: Record<PhysicalReleaseCard["mediaFormat"], string> =
  {
    cd: "Audio CD",
    dvd: "Video DVD",
    vinyl_12: '12" Vinyl',
    vinyl_7: '7" Vinyl',
  };

interface ProductRow {
  id: string;
  title: string;
  status: string;
  price: number;
  design?: MerchDesign;
  physical?: PhysicalReleaseCard;
}

export function MerchStudio() {
  const [view, setView] = useState<"products" | "catalog">("products"),
    [chooserOpen, setChooserOpen] = useState(false),
    [designProduct, setDesignProduct] = useState<string | null>(null),
    [reviewDesign, setReviewDesign] = useState<MerchDesign | undefined>(),
    [designerDirty, setDesignerDirty] = useState(false),
    [discardOpen, setDiscardOpen] = useState(false),
    catalog = useMerchCatalogQuery();
  const closeDesigner = () => {
    setDesignProduct(null);
    setReviewDesign(undefined);
    setDesignerDirty(false);
  };
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-7 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            SoundKit for creators
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Merch Studio
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Turn your world into something fans can hold. Create merch, build
            physical releases, and manage your products.
          </p>
        </div>
        <Button onClick={() => setChooserOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create product
        </Button>
      </header>
      <div className="flex gap-2 border-b pb-3">
        <Button
          variant={view === "products" ? "secondary" : "ghost"}
          aria-pressed={view === "products"}
          onClick={() => setView("products")}
        >
          Your products
        </Button>
        <Button
          variant={view === "catalog" ? "secondary" : "ghost"}
          aria-pressed={view === "catalog"}
          onClick={() => setView("catalog")}
        >
          Explore catalog
        </Button>
      </div>
      {view === "products" && (
        <ProductManager
          onCreate={() => setChooserOpen(true)}
          onReview={(design) => {
            setReviewDesign(design);
            setDesignProduct(design.printfulCatalogProductId);
          }}
        />
      )}
      {view === "catalog" && (
        <MerchDiscovery
          catalog={catalog}
          onDesign={setDesignProduct}
          onBack={() => setView("products")}
        />
      )}
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="text-2xl">Create a product</DialogTitle>
          <DialogDescription>
            Choose what you want to bring to your fans.
          </DialogDescription>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              className="group flex flex-col gap-5 rounded-lg border bg-muted/20 p-6 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => {
                setChooserOpen(false);
                setView("catalog");
              }}
            >
              <Shirt className="size-12 text-primary" />
              <span className="flex flex-col gap-2">
                <span className="font-semibold">Design merch</span>
                <span className="text-sm text-muted-foreground">
                  Make apparel, accessories, and essentials your own.
                </span>
              </span>
              <ArrowRight className="mt-auto size-4" />
            </button>
            <CreationLink
              icon="physical"
              title="Physical edition"
              text="Create a CD, vinyl, or DVD from a project."
            />
            <CreationLink
              icon="digital"
              title="Digital release"
              text="Manage downloads and releases in your projects."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Physical editions require a linked Kunaki product before they can go
            on sale.
          </p>
        </DialogContent>
      </Dialog>
      <MerchDiscardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={closeDesigner}
      />
      <Dialog
        open={designProduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (designerDirty) {
              setDiscardOpen(true);
            } else {
              closeDesigner();
            }
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto xl:max-w-7xl">
          <DialogTitle>Make it yours</DialogTitle>
          <DialogDescription>
            Add a print-ready file and your product details.
          </DialogDescription>
          {designProduct && (
            <MerchDesigner
              key={reviewDesign?.id ?? designProduct}
              design={reviewDesign}
              onDirtyChange={setDesignerDirty}
              initialProductId={designProduct}
              products={(catalog.data?.products ?? []).filter(
                (product) => !product.isDiscontinued
              )}
              variants={catalog.data?.variants ?? []}
              onCreated={() => {
                setDesignProduct(null);
                setReviewDesign(undefined);
                setDesignerDirty(false);
                setView("products");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MerchDiscovery({
  catalog,
  onDesign,
  onBack,
}: {
  catalog: ReturnType<typeof useMerchCatalogQuery>;
  onDesign: (id: string) => void;
  onBack: () => void;
}) {
  if (catalog.isPending) {
    return (
      <output className="py-16 text-center text-muted-foreground">
        Loading the catalog…
      </output>
    );
  }
  if (catalog.isError) {
    return (
      <LoadError
        label="The catalog couldn't load."
        retry={() => {
          void catalog.refetch();
        }}
      />
    );
  }
  return (
    <MerchCatalog
      products={catalog.data?.products ?? []}
      variants={catalog.data?.variants ?? []}
      onDesign={onDesign}
      onBack={onBack}
    />
  );
}

function CreationLink({
  icon,
  title,
  text,
}: {
  icon: "physical" | "digital";
  title: string;
  text: string;
}) {
  const Icon = icon === "physical" ? Disc3 : Download;
  return (
    <Link
      className="flex flex-col gap-5 rounded-lg border bg-muted/20 p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
      to="/dashboard/projects"
    >
      <Icon className="size-12 text-muted-foreground" />
      <span className="flex flex-col gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="mt-auto size-4" />
    </Link>
  );
}

function LoadError({ label, retry }: { label: string; retry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border py-12"
    >
      <p>{label}</p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

function ProductManager({
  onCreate,
  onReview,
}: {
  onCreate: () => void;
  onReview: (design: MerchDesign) => void;
}) {
  const designs = useMerchDesignsQuery(),
    physical = usePhysicalReleasesQuery(),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [type, setType] = useState("all"),
    [page, setPage] = useState(1),
    rows: ProductRow[] = [
      ...(designs.data ?? []).map((design) => ({
        design,
        id: `merch-${design.id}`,
        price: design.retailPriceCents,
        status: design.status,
        title: design.title,
      })),
      ...(physical.data ?? []).map((release) => ({
        id: `physical-${release.id}`,
        physical: release,
        price: release.retailPriceCents,
        status: release.status,
        title: release.title,
      })),
    ],
    filtered = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(search.toLowerCase()) &&
        (status === "all" || row.status === status) &&
        (type === "all" ||
          (type === "merch" ? Boolean(row.design) : Boolean(row.physical)))
    ),
    pages = Math.max(1, Math.ceil(filtered.length / 10)),
    currentPage = Math.min(page, pages),
    visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  return (
    <section className="flex flex-col gap-5" aria-label="Product manager">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Products{" "}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {rows.length}
          </span>
        </h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative min-w-44 flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label="Search your products"
              placeholder="Search products"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Filter by status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {["all", "draft", "ready", "published", "archived"].map(
                  (item) => (
                    <SelectItem key={item} value={item}>
                      {item === "all"
                        ? "All statuses"
                        : item.charAt(0).toUpperCase() + item.slice(1)}
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Filter by product type" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="merch">Merch</SelectItem>
                <SelectItem value="physical">Physical media</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      {(designs.isError || physical.isError) && (
        <LoadError
          label="Some products couldn't load. Retry to see the full list."
          retry={() => {
            void designs.refetch();
            void physical.refetch();
          }}
        />
      )}
      {(designs.isPending || physical.isPending) && (
        <output className="py-16 text-center text-muted-foreground">
          Loading your products…
        </output>
      )}
      {!designs.isPending && !physical.isPending && filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="hidden grid-cols-[minmax(0,1fr)_130px_130px_48px] gap-4 border-b bg-muted/40 px-5 py-3 text-xs text-muted-foreground sm:grid">
            <span>Product</span>
            <span>Status</span>
            <span>Retail price</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y">
            {visible.map((row) => (
              <ProductListRow key={row.id} row={row} onReview={onReview} />
            ))}
          </ul>
        </div>
      )}
      {!designs.isPending &&
        !physical.isPending &&
        filtered.length === 0 &&
        !designs.isError &&
        !physical.isError && (
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/10 px-6 py-20 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Package className="size-7 text-primary" />
            </span>
            <h3 className="text-xl font-semibold">
              {rows.length
                ? "No matching products"
                : "Your next drop starts here"}
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {rows.length
                ? "Try another search or change your filters."
                : "From the first tee to a physical release, give your fans a new way to be part of your music."}
            </p>
            <Button
              onClick={
                rows.length
                  ? () => {
                      setSearch("");
                      setStatus("all");
                      setType("all");
                    }
                  : onCreate
              }
            >
              {rows.length ? "Clear filters" : "Create your first product"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        )}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            {(currentPage - 1) * 10 + 1}–
            {Math.min(currentPage * 10, filtered.length)} of {filtered.length}{" "}
            products
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span>
              {currentPage} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProductListRow({
  row,
  onReview,
}: {
  row: ProductRow;
  onReview: (design: MerchDesign) => void;
}) {
  const mockups = useMerchDesignMockupsQuery(row.design?.id ?? null),
    image = mockups.data?.find(
      (mockup) => mockup.status === "completed" && mockup.mockupUrl
    )?.mockupUrl;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_130px_130px_48px] sm:px-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {image && (
            <AppImage
              src={image}
              alt={`${row.title} mockup`}
              width={64}
              height={64}
              className="size-full object-cover"
            />
          )}
          {!image && row.physical && (
            <Disc3 className="size-6 text-muted-foreground" />
          )}
          {!image && !row.physical && (
            <Shirt className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="break-words font-medium">{row.title}</p>
          <p className="text-xs text-muted-foreground">
            {row.physical
              ? MEDIA_FORMAT_LABELS[row.physical.mediaFormat]
              : "Print on demand"}
            {row.design?.mockupCount
              ? ` · ${row.design.readyMockupCount}/${row.design.mockupCount} mockups ready`
              : ""}
          </p>
          {row.physical && !row.physical.kunakiProductId && (
            <p className="text-xs text-muted-foreground">
              Setup required: link a Kunaki product in your project.
            </p>
          )}
          <span className="text-sm text-muted-foreground sm:hidden">
            {row.status} · {merchPrice(row.price)}
          </span>
        </div>
      </div>
      <Badge
        className="hidden w-fit capitalize sm:inline-flex"
        variant={row.status === "published" ? "default" : "outline"}
      >
        {row.status}
      </Badge>
      <span className="hidden tabular-nums sm:block">
        {merchPrice(row.price)}
      </span>
      {row.design ? (
        <DesignActions
          design={row.design}
          onReview={() => {
            if (row.design) {
              onReview(row.design);
            }
          }}
        />
      ) : (
        <Button asChild size="icon" variant="ghost">
          <Link
            aria-label={`Manage ${row.title} in projects`}
            to="/dashboard/projects"
          >
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
    </li>
  );
}

function DesignActions({
  design,
  onReview,
}: {
  design: MerchDesign;
  onReview: () => void;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false),
    update = useUpdateMerchDesignMutation(),
    archive = useDeleteMerchDesignMutation(),
    { toast } = useToast(),
    pending = update.isPending || archive.isPending,
    onError = (error: unknown) =>
      toast({
        description:
          error instanceof Error ? error.message : "Please try again.",
        title: "Product update failed",
        variant: "destructive",
      });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Actions for ${design.title}`}
            disabled={pending}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onReview}>
              Review product
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={
                design.status === "archived" ||
                (design.status !== "published" && design.readyMockupCount === 0)
              }
              onSelect={() =>
                design.status !== "archived" &&
                update.mutate(
                  {
                    id: design.id,
                    status:
                      design.status === "published" ? "draft" : "published",
                  },
                  {
                    onError,
                    onSuccess: () =>
                      toast({
                        title:
                          design.status === "published"
                            ? "Product unpublished"
                            : "Product published",
                      }),
                  }
                )
              }
            >
              {design.status === "published" ? "Unpublish" : "Publish"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={design.status === "archived"}
              onSelect={() => setArchiveOpen(true)}
            >
              Archive product
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Archive {design.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the product from sale. It stays in your product list as
            archived.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                archive.mutate(design.id, {
                  onError,
                  onSuccess: () => toast({ title: "Product archived" }),
                })
              }
            >
              Archive product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
