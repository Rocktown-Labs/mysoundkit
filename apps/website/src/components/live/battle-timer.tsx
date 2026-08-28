import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";

interface BattleTimerProps {
  phaseEndsAt: number | null | undefined;
  serverNow?: number;
  label?: string;
}

export function BattleTimer({
  label = "Time remaining",
  phaseEndsAt,
  serverNow,
}: BattleTimerProps) {
  const [now, setNow] = useState(() => Date.now()),
    [clockOffset, setClockOffset] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setClockOffset(serverNow ? serverNow - Date.now() : 0);
  }, [serverNow]);

  const remainingMs = useMemo(() => {
      if (!phaseEndsAt) {
        return 0;
      }
      return Math.max(0, phaseEndsAt - (now + clockOffset));
    }, [clockOffset, now, phaseEndsAt]),
    totalSeconds = Math.ceil(remainingMs / 1000),
    minutes = Math.floor(totalSeconds / 60),
    seconds = totalSeconds % 60;

  return (
    <Badge
      className="gap-2 bg-black/70 font-mono text-white backdrop-blur-md"
      variant="outline"
    >
      <span className="text-[10px] uppercase tracking-wider text-white/60">
        {label}
      </span>
      <span aria-live="polite" className="text-sm tabular-nums">
        {phaseEndsAt
          ? `${minutes}:${seconds.toString().padStart(2, "0")}`
          : "Waiting"}
      </span>
    </Badge>
  );
}
