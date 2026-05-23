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
          "flex h-8 min-w-20 shrink-0 items-center justify-center border border-white/40 px-2 font-notable text-xs leading-none text-white uppercase group-data-[collapsible=icon]:hidden",
          wordmarkClassName
        )}
        data-soundkit-sidebar-wordmark
      >
        SoundKit
      </span>
      <AppImage
        alt="SoundKit"
        className={cn(
          "hidden size-7 shrink-0 group-data-[collapsible=icon]:block",
          markClassName
        )}
        height={48}
        src="/soundkit-mark.svg"
        width={48}
      />
    </div>
  );
}
