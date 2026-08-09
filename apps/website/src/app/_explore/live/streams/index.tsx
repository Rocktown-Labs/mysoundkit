import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_explore/live/streams/")({
  component: LiveStreamsPage,
});

function LiveStreamsPage() {
  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-2xl">
            <Radio className="size-6 text-primary" />
            Creator Streams
          </h2>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Browse public creator broadcasts as soon as artists start streaming
            from SoundKit.
          </p>
        </div>
        <Button asChild>
          <Link search={{}} to="/login">
            <Plus className="mr-2 size-4" />
            Start A Stream
          </Link>
        </Button>
      </section>

      <div className="rounded-lg border border-dashed p-8 text-muted-foreground text-sm">
        No public creator streams are live right now.
      </div>
    </div>
  );
}
