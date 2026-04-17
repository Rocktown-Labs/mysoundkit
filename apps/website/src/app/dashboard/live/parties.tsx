import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Headphones, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/live/parties")({
  component: DashboardLivePartiesPage,
});

function DashboardLivePartiesPage() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Live Parties</h1>
        <p className="mt-2 text-muted-foreground">
          Prep listener experiences, invite guests, and keep party programming
          moving.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="size-5" />
              Active Parties
            </CardTitle>
            <CardDescription>
              Currently scheduled listening rooms.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">3</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              RSVPs This Week
            </CardTitle>
            <CardDescription>
              Fans lined up for upcoming sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">842</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5" />
              Next Drop
            </CardTitle>
            <CardDescription>
              Your next party is queued for Friday night.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/live/parties">Open Public Parties</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
