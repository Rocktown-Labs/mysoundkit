import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { BattleViewAll } from "@/components/explore/battle-view-all";

export const Route = createFileRoute("/_explore/live/battles/upcoming")({
  component: UpcomingBattlesPage,
});

function UpcomingBattlesPage() {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<string>("global");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");

  const genres = [
    "All",
    "Hip-Hop",
    "R&B",
    "Electronic",
    "Pop",
    "Rock",
    "Jazz",
    "Country",
  ];
  const locations = [
    "Global",
    "California",
    "New York",
    "Texas",
    "Georgia",
    "Florida",
  ];

  const upcomingBattles = Array.from({ length: 20 }, (_, i) => ({
    artist1: {
      avatar: "/diverse-user-avatars.png",
      battles: Math.floor(Math.random() * 70) + 15,
      genre: genres[Math.floor(Math.random() * (genres.length - 1)) + 1],
      name: `Artist ${i * 2 + 1}`,
      topSongs: [
        `Hit Song ${i * 3 + 1}`,
        `Popular Track ${i * 3 + 2}`,
        `Chart Topper ${i * 3 + 3}`,
      ],
      wins: Math.floor(Math.random() * 50) + 10,
    },
    artist2: {
      avatar: "/diverse-user-avatars.png",
      battles: Math.floor(Math.random() * 70) + 15,
      genre: genres[Math.floor(Math.random() * (genres.length - 1)) + 1],
      name: `Artist ${i * 2 + 2}`,
      topSongs: [
        `Smash Hit ${i * 3 + 1}`,
        `Fan Favorite ${i * 3 + 2}`,
        `Viral Track ${i * 3 + 3}`,
      ],
      wins: Math.floor(Math.random() * 50) + 10,
    },
    format: ["Best of 3", "Best of 5", "Best of 7"][
      Math.floor(Math.random() * 3)
    ],
    id: `upcoming-${i + 1}`,
    scheduledTime: new Date(
      Date.now() + Math.random() * 86_400_000
    ).toLocaleString(),
    startsIn: `${Math.floor(Math.random() * 23) + 1} hours`,
  }));

  return (
    <BattleViewAll
      type="upcoming"
      title="Upcoming Battles"
      description="Scheduled battles for the next 24 hours"
      battles={upcomingBattles}
      selectedLocation={selectedLocation}
      setSelectedLocation={setSelectedLocation}
      selectedGenre={selectedGenre}
      setSelectedGenre={setSelectedGenre}
      locations={locations}
      genres={genres}
    />
  );
}
