import { StreamCard } from "@/components/cards/stream-card";
import { NativeCollectionGrid } from "@/components/native-collection-grid";
import { NativePageScreen } from "@/components/native-page-screen";
import { usePublicLiveExperiencesQuery } from "@/lib/soundkit-api";

export default function StreamsScreen() {
  const streams = usePublicLiveExperiencesQuery("stream", {
    region: "all",
    regionType: "global",
  });

  return (
    <NativePageScreen
      description="Creator broadcasts happening now."
      title="Streams"
    >
      <NativeCollectionGrid
        empty="No live streams currently broadcasting."
        items={streams.data ?? []}
        keyForItem={(stream) => stream.id}
        renderItem={(stream) => <StreamCard stream={stream} fluid />}
        isLoading={streams.isLoading}
      />
    </NativePageScreen>
  );
}
