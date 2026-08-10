/* eslint-disable unicorn/filename-case */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, FileAudio, ShoppingBag } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { downloadFileFromApi } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useLibraryPurchaseQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/library/purchased/$purchaseId")(
  {
    component: PurchaseDetailPage,
  }
);

const handleDownload = async ({
  downloadUrl,
  label,
  title,
}: {
  downloadUrl: string | null;
  label: string;
  title: string;
}) => {
  if (!downloadUrl) {
    toast({
      description: "No guarded download is available for this file.",
      title: "Download unavailable",
      variant: "destructive",
    });
    return;
  }

  try {
    await downloadFileFromApi({
      fallbackFileName: `${title}-${label}.download`,
      url: downloadUrl,
    });
    toast({
      description: `Downloading ${title}...`,
      title: "Starting download",
    });
  } catch (error) {
    toast({
      description:
        error instanceof Error ? error.message : "Unable to download.",
      title: "Download unavailable",
      variant: "destructive",
    });
  }
};

function PurchaseDetailPage() {
  const { purchaseId } = Route.useParams();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const purchaseQuery = useLibraryPurchaseQuery(session ? purchaseId : "");
  const redirectPath = `/library/purchased/${purchaseId}`;

  if (isSessionPending) {
    return (
      <div className="space-y-6 px-4 py-6 md:px-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
        <ShoppingBag className="size-10 text-primary" />
        <div>
          <h1 className="font-bold text-2xl">Sign in to view your purchase</h1>
          <p className="mt-2 text-muted-foreground">
            After signing in, SoundKit will bring you back to this purchase and
            show your available downloads.
          </p>
        </div>
        <Button asChild={true}>
          <Link search={{ redirect: redirectPath }} to="/login">
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  if (purchaseQuery.isLoading) {
    return (
      <div className="space-y-6 px-4 py-6 md:px-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (purchaseQuery.error || !purchaseQuery.data) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
        <ShoppingBag className="size-10 text-muted-foreground" />
        <div>
          <h1 className="font-bold text-2xl">Purchase not found</h1>
          <p className="mt-2 text-muted-foreground">
            This purchase may belong to another account or may no longer be
            available.
          </p>
        </div>
        <Button asChild={true} variant="outline">
          <Link to="/library/purchased">Back to purchases</Link>
        </Button>
      </div>
    );
  }

  const { downloads, purchase } = purchaseQuery.data;

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <Button asChild={true} className="-ml-2" size="sm" variant="ghost">
        <Link to="/library/purchased">
          <ArrowLeft className="mr-2 size-4" />
          Back to purchases
        </Link>
      </Button>

      <section className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <AppImage
          alt={purchase.title}
          className="aspect-square w-full max-w-44 rounded-md object-cover"
          height={176}
          layout="fixed"
          src={purchase.cover}
          width={176}
        />
        <div className="space-y-4">
          <div>
            <Badge variant="secondary">
              {purchase.purchaseMode === "license"
                ? (purchase.licenseName ?? "License")
                : "Digital Download"}
            </Badge>
            <h1 className="mt-3 font-bold text-3xl">{purchase.title}</h1>
            <p className="mt-1 text-muted-foreground">
              {purchase.artist} · {purchase.priceLabel} · Purchased{" "}
              {purchase.purchasedAt}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild={true} variant="outline">
              <Link
                params={{ username: purchase.artistSlug }}
                to="/artist/$username"
              >
                View artist
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-xl">Downloads</h2>
          <p className="text-muted-foreground text-sm">
            Files available for this purchase.
          </p>
        </div>
        {downloads.length > 0 ? (
          <div className="divide-y rounded-md border">
            {downloads.map((download) => (
              <div
                className="flex items-center justify-between gap-4 p-4"
                key={download.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileAudio className="size-5 text-primary" />
                  <p className="truncate font-medium capitalize">
                    {download.label}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    handleDownload({
                      downloadUrl: download.downloadUrl,
                      label: download.label,
                      title: purchase.title,
                    }).catch(() => {})
                  }
                  size="sm"
                >
                  <Download className="mr-2 size-4" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-muted-foreground text-sm">
            No download files are available for this purchase yet.
          </div>
        )}
      </section>
    </div>
  );
}
