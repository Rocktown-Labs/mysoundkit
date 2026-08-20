import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { SoundKitBrand } from "@/components/soundkit-brand";
import { Button } from "@/components/ui/button";

export function AuthShell({
  backHref = "/signup",
  backLabel = "Back",
  children,
  subtitle,
  title,
}: {
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Button
            asChild
            className="mb-6 text-muted-foreground"
            variant="ghost"
          >
            <a href={backHref}>
              <ArrowLeft className="mr-2 size-4" />
              {backLabel}
            </a>
          </Button>
          <SoundKitBrand variant="wordmark" wordmarkClassName="h-11" />
          <h1 className="mt-6 font-[family-name:var(--font-playfair)] text-3xl font-bold">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
    </main>
  );
}
