import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
      <span className="sr-only"> required</span>
    </>
  );
}

export function RequiredFieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <RequiredMark />
    </Label>
  );
}
