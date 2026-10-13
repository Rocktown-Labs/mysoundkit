import { useEffect, useRef } from "react";

import { useSidebar } from "@/components/ui/sidebar";

/**
 * Collapses the dashboard app sidebar to icon-only while an immersive
 * chat-style route is open, and restores the visitor's previous choice
 * when they leave. Use inside routes rendered by the dashboard layout.
 */
export function useImmersiveDashboardSidebar() {
  const { open, setOpen } = useSidebar(),
    initialOpenRef = useRef(open);

  useEffect(() => {
    const initialOpen = initialOpenRef.current;

    setOpen(false);

    return () => {
      setOpen(initialOpen);
    };
  }, [setOpen]);
}
