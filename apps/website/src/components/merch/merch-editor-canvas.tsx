/* eslint-disable one-var, sort-vars -- Keep pointer-event state and calculations in execution order. */
import { useRef } from "react";
import type { PointerEvent } from "react";

import { AppImage } from "@/components/ui/app-image";

import { clampMerchPosition } from "../../../../../packages/db/src/merch-design";
import type {
  MerchPosition,
  MerchPrintArea,
} from "../../../../../packages/db/src/merch-design";

export function MerchEditorCanvas({
  src,
  area,
  position,
  onChange,
  disabled = false,
}: {
  src: string;
  area: MerchPrintArea;
  position: MerchPosition;
  onChange: (position: MerchPosition) => void;
  disabled?: boolean;
}) {
  const canvas = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; position: MerchPosition } | null>(
      null
    ),
    start = (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { position, x: event.clientX, y: event.clientY };
    },
    move = (event: PointerEvent<HTMLButtonElement>) => {
      const bounds = canvas.current?.getBoundingClientRect(),
        origin = drag.current;
      if (!origin || !bounds || disabled) {
        return;
      }
      onChange(
        clampMerchPosition(
          {
            ...origin.position,
            left:
              origin.position.left +
              ((event.clientX - origin.x) / bounds.width) * area.width,
            top:
              origin.position.top +
              ((event.clientY - origin.y) / bounds.height) * area.height,
          },
          area
        )
      );
    };
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        {area.placement.replaceAll("_", " ")} · {area.width} × {area.height} in
        · {area.dpi} DPI minimum
      </p>
      <div
        ref={canvas}
        data-testid="merch-print-area"
        className="relative w-full max-w-lg overflow-hidden border border-dashed border-muted-foreground bg-muted"
        style={{
          aspectRatio: `${area.width}/${area.height}`,
          backgroundImage:
            "repeating-conic-gradient(var(--background) 0% 25%, transparent 0% 50%)",
          backgroundSize: "24px 24px",
        }}
      >
        <button
          aria-label="Move artwork with arrow keys or drag"
          type="button"
          disabled={disabled}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const directions: Record<string, [number, number]> = {
                ArrowDown: [0, 1],
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
              },
              delta = directions[event.key];
            if (!delta) {
              return;
            }
            event.preventDefault();
            const step = event.shiftKey ? 0.5 : 0.05;
            onChange(
              clampMerchPosition(
                {
                  ...position,
                  left: position.left + delta[0] * step,
                  top: position.top + delta[1] * step,
                },
                area
              )
            );
          }}
          className="absolute touch-none cursor-move border border-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
          style={{
            height: `${(position.height / area.height) * 100}%`,
            left: `${(position.left / area.width) * 100}%`,
            top: `${(position.top / area.height) * 100}%`,
            width: `${(position.width / area.width) * 100}%`,
          }}
        >
          <AppImage
            alt="Your artwork in the print area"
            src={src}
            width={600}
            height={600}
            className="pointer-events-none size-full select-none object-fill"
          />
        </button>
      </div>
      <p className="max-w-lg text-center text-xs text-muted-foreground">
        This is the print area at its actual proportions. Drag or use arrow keys
        to move your artwork. Generated mockups show its placement on the
        finished product.
      </p>
    </div>
  );
}
