import { useCallback, useEffect, useRef, useState } from "react";

export const useBrowserFullscreen = () => {
  const containerRef = useRef<HTMLDivElement | null>(null),
    [isFullscreen, setIsFullscreen] = useState(false),
    toggleFullscreen = useCallback(async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } catch {
        setIsFullscreen(Boolean(document.fullscreenElement));
      }
    }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return { containerRef, isFullscreen, toggleFullscreen };
};
