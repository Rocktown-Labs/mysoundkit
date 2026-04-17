import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Music } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { BattleFilters } from "@/components/explore/battle-filters";
import { TrackCard } from "@/components/explore/track-card";
import { Button } from "@/components/ui/button";

const sortOptions = [
  { label: "Most Played", value: "plays-desc" },
  { label: "Least Played", value: "plays-asc" },
  { label: "Title (A-Z)", value: "title-asc" },
  { label: "Title (Z-A)", value: "title-desc" },
];

export const Route = createFileRoute("/_explore/tracks/")({
  component: TracksPage,
});

function TracksPage() {
  const router = useRouter();
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const isInitialMount = useRef(true);

  const [regionType, setRegionType] = useState<"north-america" | "global">(
    "north-america"
  );
  const [region, setRegion] = useState("all");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("plays-desc");

  // Initialize from URL params or localStorage
  useEffect(() => {
    const urlRegionType = searchParams.get("regionType") as
      | "north-america"
      | "global"
      | null;
    const urlRegion = searchParams.get("region");
    const urlGenre = searchParams.get("genre");
    const urlSort = searchParams.get("sort");

    if (urlRegionType || urlRegion || urlGenre || urlSort) {
      if (urlRegionType) {
        setRegionType(urlRegionType);
      }
      if (urlRegion) {
        setRegion(urlRegion);
      }
      if (urlGenre) {
        setGenre(urlGenre);
      }
      if (urlSort) {
        setSort(urlSort);
      }
    } else {
      const savedRegionType = localStorage.getItem("exploreRegionType") as
        | "north-america"
        | "global"
        | null;
      const savedRegion = localStorage.getItem("exploreRegion");
      if (savedRegionType) {
        setRegionType(savedRegionType);
      }
      if (savedRegion) {
        setRegion(savedRegion);
      }
    }
  }, [searchParams]);

  // Update URL and localStorage on filter changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams();
    params.set("regionType", regionType);
    params.set("region", region);
    params.set("genre", genre);
    params.set("sort", sort);

    localStorage.setItem("exploreRegionType", regionType);
    localStorage.setItem("exploreRegion", region);
  }, [regionType, region, genre, sort, router]);

  const tracks = [
    {
      artist: "Luna Eclipse",
      artistSlug: "luna-eclipse",
      cover: "/summer-music-album-cover.png",
      duration: "3:24",
      id: "track-1",
      plays: "2.4M",
      title: "Summer Nights",
    },
    {
      artist: "Neon Pulse",
      artistSlug: "neon-pulse",
      cover: "/night-music-album-cover.png",
      duration: "4:12",
      id: "track-2",
      plays: "1.8M",
      title: "Midnight Dreams",
    },
    {
      artist: "Street Poet",
      artistSlug: "street-poet",
      cover: "/hip-hop-album-cover.png",
      duration: "3:45",
      id: "track-3",
      plays: "3.1M",
      title: "Urban Legends",
    },
    {
      artist: "Voltage Dreams",
      artistSlug: "voltage-dreams",
      cover: "/summer-music-album-cover.png",
      duration: "3:56",
      id: "track-4",
      plays: "1.2M",
      title: "Electric Soul",
    },
    {
      artist: "Metro Flow",
      artistSlug: "metro-flow",
      cover: "/night-music-album-cover.png",
      duration: "3:18",
      id: "track-5",
      plays: "2.7M",
      title: "City Lights",
    },
    {
      artist: "Ocean Drive",
      artistSlug: "ocean-drive",
      cover: "/hip-hop-album-cover.png",
      duration: "4:02",
      id: "track-6",
      plays: "1.5M",
      title: "Wave Rider",
    },
    {
      artist: "Cyber Sound",
      artistSlug: "cyber-sound",
      cover: "/summer-music-album-cover.png",
      duration: "3:33",
      id: "track-7",
      plays: "1.9M",
      title: "Neon Dreams",
    },
    {
      artist: "Beat Smith",
      artistSlug: "beat-smith",
      cover: "/night-music-album-cover.png",
      duration: "3:47",
      id: "track-8",
      plays: "2.2M",
      title: "Rhythm Flow",
    },
  ];

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="size-4 mr-2" />
        Back
      </Button>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-2">
          <Music className="size-6 md:size-8 text-primary" />
          Top Songs
        </h1>
      </div>

      <BattleFilters
        regionType={regionType}
        region={region}
        genre={genre}
        sort={sort}
        onRegionTypeChange={setRegionType}
        onRegionChange={setRegion}
        onGenreChange={setGenre}
        onSortChange={setSort}
        sortOptions={sortOptions}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            id={track.id}
            title={track.title}
            artist={track.artist}
            artistSlug={track.artistSlug}
            cover={track.cover}
            plays={track.plays}
            duration={track.duration}
          />
        ))}
      </div>
    </div>
  );
}
