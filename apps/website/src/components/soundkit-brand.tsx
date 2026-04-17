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
      <AppImage
        alt="SoundKit"
        className={cn(
          "h-8 w-auto shrink-0 group-data-[collapsible=icon]:hidden",
          wordmarkClassName
        )}
        height={100}
        src="/soundkit-wordmark.svg"
        width={250}
      />
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
