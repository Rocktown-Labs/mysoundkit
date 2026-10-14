import { useLocalSearchParams } from "expo-router";

import { VideoCard } from "@/components/cards/video-card";
import { NativeCollectionGrid } from "@/components/native-collection-grid";
import { NativePageScreen } from "@/components/native-page-screen";
import { useVideosQuery } from "@/lib/soundkit-api";

export default function VideosScreen() {
  const params = useLocalSearchParams<{ region?: string }>(),
    region = params.region ?? "all",
    regionType =
      region === "all" ? ("global" as const) : ("north-america" as const),
    videos = useVideosQuery({ limit: 24, region, regionType, scope: "public" });

  return (
    <NativePageScreen
      description="Music videos and visual releases."
      title="Videos"
    >
      <NativeCollectionGrid
        empty="No videos are live for this view yet."
        items={videos.data ?? []}
        keyForItem={(video) => video.id}
        renderItem={(video) => <VideoCard video={video} />}
        isLoading={videos.isLoading}
      />
    </NativePageScreen>
  );
}
