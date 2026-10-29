import { ChevronLeft } from "lucide-react";
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
    <main className="dark flex min-h-svh items-center bg-[#020202] px-5 py-8 font-sans text-[#FAFAFA] sm:py-12">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="mb-[22px] flex flex-col items-center text-center">
          <div className="relative mb-4 flex min-h-[52px] w-full items-center justify-center">
            <Button
              asChild
              className="absolute left-0 size-10 rounded-full border border-[#27272A] bg-[#141417] p-0 text-[#FAFAFA] transition-transform hover:bg-[#27272A] hover:text-[#FAFAFA] dark:hover:text-[#FAFAFA] dark:hover:bg-[#27272A] active:scale-95"
              variant="ghost"
            >
              <a aria-label={backLabel} href={backHref}>
                <ChevronLeft aria-hidden="true" className="size-[22px]" />
              </a>
            </Button>
            <SoundKitBrand
              className="justify-center"
              variant="wordmark"
              wordmarkClassName="h-[52px] w-[150px]"
            />
          </div>
          <h1 className="mb-1.5 text-[28px] font-extrabold tracking-[-0.6px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="max-w-[340px] text-sm leading-5 text-[#A1A1AA]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </main>
  );
}
