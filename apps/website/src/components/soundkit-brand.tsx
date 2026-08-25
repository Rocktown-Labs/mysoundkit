import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils";

interface SoundKitBrandProps {
  className?: string;
  markClassName?: string;
  variant?: "sidebar" | "wordmark";
  wordmarkClassName?: string;
}

export function SoundKitBrand({
  className,
  markClassName,
  variant = "sidebar",
  wordmarkClassName,
}: SoundKitBrandProps) {
  if (variant === "wordmark") {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <AppImage
          alt="SoundKit"
          className={cn("h-10 w-auto shrink-0", wordmarkClassName)}
          height={100}
          src="/soundkit-wordmark.svg"
          width={250}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex w-full items-center justify-center", className)}>
      <span
        className={cn(
          "flex h-9 w-full shrink-0 items-center justify-center border border-white/45 px-3 font-notable text-base leading-none text-white uppercase shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] group-data-[collapsible=icon]:hidden",
          wordmarkClassName
        )}
        data-soundkit-sidebar-wordmark
      >
        SoundKit
      </span>
      <span
        aria-label="SoundKit"
        className={cn(
          "hidden size-7 shrink-0 items-center justify-center border border-white/45 font-notable text-sm leading-none text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] group-data-[collapsible=icon]:flex",
          markClassName
        )}
        data-soundkit-sidebar-mark
      >
        S
      </span>
    </div>
  );
}
