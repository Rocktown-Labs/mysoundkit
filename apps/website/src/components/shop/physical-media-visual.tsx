import { Disc3 } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils";

export type PhysicalVisualFormat = "cd" | "dvd" | "vinyl_12" | "vinyl_7";

interface PhysicalMediaVisualProps {
  artworkUrl: string | null;
  className?: string;
  format: PhysicalVisualFormat;
  size?: "lg" | "md" | "sm";
  title: string;
}

/**
 * Pure-CSS physical media product showcase derived from the album or video
 * artwork without relying on external third-party texture URLs.
 *
 * - Vinyl (12" / 7"): Matte sleeve with subtle edge lighting + grooved dark
 *   record peeking out the right edge with the release artwork on the center label.
 * - CD: Translucent jewel-case ribbed left spine + acrylic sheen + iridescent
 *   silver disc peeking out the right edge.
 * - DVD: Portrait keep-case with dark molded spine + glossy wrap + metallic
 *   DVD disc peeking out the right edge.
 */
export function PhysicalMediaVisual({
  artworkUrl,
  className,
  format,
  size = "md",
  title,
}: PhysicalMediaVisualProps) {
  const isVinyl = format === "vinyl_12" || format === "vinyl_7",
    isSevenInch = format === "vinyl_7",
    isDvd = format === "dvd",
    paddingClass =
      size === "lg" ? "p-6 sm:p-10" : (size === "sm" ? "p-2.5" : "p-4");

  return (
    <div
      className={cn(
        "relative flex aspect-square w-full items-center justify-center overflow-hidden bg-gradient-to-br from-muted/80 via-card to-background",
        paddingClass,
        className
      )}
    >
      {/* Ambient backdrop glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(circle at 38% 35%, color-mix(in oklch, var(--primary) 35%, transparent), transparent 68%)",
        }}
      />

      {/* Sleeve / Case + Peeking Disc assembly */}
      <div
        className={cn(
          "relative flex items-center justify-start",
          isDvd
            ? "h-[86%] w-[78%] max-w-[270px]"
            : "aspect-[1.22/1] w-[92%] max-w-[380px]"
        )}
      >
        {/* Peeking Disc behind the sleeve/case */}
        <div
          aria-hidden="true"
          className={cn(
            "shop-media-disc pointer-events-none absolute z-0 rounded-full",
            isDvd
              ? "top-[10%] right-[2%] aspect-square w-[66%]"
              : (isSevenInch
                ? "top-[11%] right-[4%] aspect-square w-[62%]"
                : "top-[4%] right-[2%] aspect-square w-[74%]")
          )}
          style={
            isVinyl
              ? {
                  background:
                    "repeating-radial-gradient(circle at center, #121214 0px, #121214 2px, #1f1f24 2.5px, #101012 4px)",
                  boxShadow:
                    "0 10px 26px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.08)",
                }
              : {
                  background:
                    "conic-gradient(from 40deg, #d6d6dc, #8f96a8, #e6e0f8, #9da8b8, #f2f2f5, #7e8599, #d6d6dc)",
                  boxShadow:
                    "0 8px 22px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.45)",
                }
          }
        >
          {/* Disc light reflection sweep */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: isVinyl
                ? "conic-gradient(from 120deg, transparent 0deg, rgba(255,255,255,0.14) 24deg, transparent 54deg, transparent 180deg, rgba(255,255,255,0.1) 208deg, transparent 235deg)"
                : "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.42), transparent 58%)",
            }}
          />

          {/* Center label / hub */}
          <div
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border",
              isVinyl
                ? (isSevenInch
                  ? "size-[40%] border-white/15 bg-card"
                  : "size-[34%] border-white/15 bg-card")
                : "size-[34%] border-black/20 bg-zinc-200/80"
            )}
          >
            {isVinyl && artworkUrl ? (
              <AppImage
                alt=""
                className="size-full object-cover"
                height={120}
                src={artworkUrl}
                width={120}
              />
            ) : null}
            {/* Spindle hole */}
            <div
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                isVinyl
                  ? (isSevenInch
                    ? "size-[34%] bg-background ring-2 ring-black/40"
                    : "size-[18%] bg-background ring-1 ring-black/50")
                  : "size-[38%] bg-background/95 ring-4 ring-zinc-400/50"
              )}
            />
          </div>
        </div>

        {/* Front Cover / Sleeve / Case */}
        <div
          className={cn(
            "relative z-10 overflow-hidden bg-card",
            isDvd
              ? "aspect-[3/4] h-full rounded-[4px] border border-white/10"
              : "aspect-square h-full rounded-[4px] border border-white/10"
          )}
          style={{
            boxShadow:
              "6px 10px 24px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {/* CD Jewel Case ribbed translucent left spine */}
          {format === "cd" ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[9%] border-r border-white/25 bg-black/50 backdrop-blur-[1px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1px, transparent 1px, transparent 4px)",
              }}
            />
          ) : null}

          {/* DVD Keep-Case dark molded spine */}
          {isDvd ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[10%] border-r border-white/15 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-800/80"
            />
          ) : null}

          {/* Artwork */}
          {artworkUrl ? (
            <AppImage
              alt={`${title} cover artwork`}
              className="size-full object-cover"
              height={480}
              src={artworkUrl}
              width={480}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
              <Disc3 className="size-10 opacity-45" />
              <span className="max-w-[80%] truncate text-xs font-medium">
                {title}
              </span>
            </div>
          )}

          {/* Subtle realistic paper / acrylic cover sheen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background: isVinyl
                ? "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 42%, rgba(0,0,0,0.22) 100%)"
                : "linear-gradient(125deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 28%, transparent 46%, rgba(255,255,255,0.08) 76%, transparent 100%)",
            }}
          />

          {/* Subtle vinyl ring-wear crease hint */}
          {isVinyl ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[3%] z-10 rounded-full border border-white/[0.06]"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
