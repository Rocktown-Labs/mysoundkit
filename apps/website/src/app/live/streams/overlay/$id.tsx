"use client";

import { createFileRoute } from "@tanstack/react-router";
import { Music2, Radio } from "lucide-react";
import { useEffect } from "react";

import { AppImage } from "@/components/ui/app-image";
import { useLiveRoom } from "@/lib/live-room";

export const Route = createFileRoute("/live/streams/overlay/$id")({
  component: StreamOverlayPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
});

function StreamOverlayPage() {
  const { id } = Route.useParams(),
    { token } = Route.useSearch(),
    room = useLiveRoom(id, { overlayToken: token }),
    roomQuery = room.query,
    track = roomQuery.data?.stream?.nowPlaying;

  useEffect(() => {
    const previousBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "transparent";
    return () => {
      document.body.style.backgroundColor = previousBackground;
    };
  }, []);

  if (!token || roomQuery.isError || !track) {
    return null;
  }

  return (
    <main className="min-h-screen bg-transparent p-4 text-white">
      <div className="inline-flex max-w-[min(100%,28rem)] items-center gap-3 rounded-xl border border-white/15 bg-black/80 px-3 py-2.5 shadow-xl backdrop-blur-md">
        <AppImage
          alt=""
          className="size-12 rounded-md object-cover"
          height={48}
          src={track.coverArtUrl || "/soundkit-default-cover.svg"}
          width={48}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
            <Radio className="size-3 text-red-400" />
            Live review
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate font-semibold text-sm">
            <Music2 className="size-3.5 shrink-0 text-primary" />
            {track.title}
          </p>
          <p className="truncate text-xs text-white/70">{track.artistName}</p>
        </div>
      </div>
    </main>
  );
}
