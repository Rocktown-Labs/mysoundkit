import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Clock, MapPin, Users, Trophy, Music2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const upcomingBattles = [
  {
    date: "Jan 25, 2025",
    format: "Best of 5",
    genre: "Hip-Hop",
    id: "1",
    location: "Los Angeles, CA",
    opponent: "Metro Flow",
    status: "confirmed",
    time: "8:00 PM EST",
    viewers: 245,
  },
  {
    date: "Jan 28, 2025",
    format: "Best of 3",
    genre: "Electronic",
    id: "2",
    location: "Online",
    opponent: "Voltage Dreams",
    status: "pending",
    time: "9:30 PM EST",
    viewers: 0,
  },
  {
    date: "Feb 1, 2025",
    format: "Best of 7",
    genre: "Hip-Hop",
    id: "3",
    location: "Atlanta, GA",
    opponent: "Street Poet",
    status: "confirmed",
    time: "7:00 PM EST",
    viewers: 512,
  },
];

export const Route = createFileRoute("/dashboard/live/upcoming")({
  component: UpcomingBattlesPage,
});

function UpcomingBattlesPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <Calendar className="size-8 text-primary" />
          Upcoming Battles
        </h1>
        <p className="text-muted-foreground">Your scheduled battle events</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {upcomingBattles.map((battle) => (
          <Card
            key={battle.id}
            className="hover:bg-accent/50 transition-colors"
          >
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Music2 className="size-6 text-primary" />
                        <h2 className="text-xl font-bold">
                          vs {battle.opponent}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            battle.status === "confirmed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {battle.status === "confirmed"
                            ? "Confirmed"
                            : "Pending"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {battle.genre}
                        </span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {battle.format}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-4" />
                      <span>{battle.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="size-4" />
                      <span>{battle.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-4" />
                      <span>{battle.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="size-4" />
                      <span>{battle.viewers} interested viewers</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:min-w-[140px]">
                  <Button asChild className="w-full">
                    <Link to={`/dashboard/live/my-kit?battle=${battle.id}`}>
                      <Trophy className="mr-2 size-4" />
                      Prep Kit
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full bg-transparent">
                    View Details
                  </Button>
                  {battle.status === "pending" && (
                    <Button variant="destructive" size="sm" className="w-full">
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {upcomingBattles.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="size-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                No Upcoming Battles
              </h3>
              <p className="text-muted-foreground mb-4">
                You don't have any scheduled battles yet
              </p>
              <Button asChild>
                <Link to="/dashboard/live/find">Find a Battle</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
