import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, Video, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/live/streams")({
  component: DashboardLiveStreamsPage,
});

function DashboardLiveStreamsPage() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Creator Streams</h1>
        <p className="mt-2 text-muted-foreground">
          Plan stream sessions, track live audience momentum, and send fans to
          the public watch experience.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="size-5" />
              Scheduled Streams
            </CardTitle>
            <CardDescription>
              Upcoming creator broadcasts ready to go live.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">5</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Peak Viewers
            </CardTitle>
            <CardDescription>
              Best live audience reached this month.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">12.4k</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="size-5" />
              Watch Experience
            </CardTitle>
            <CardDescription>
              Preview the public creator stream destination.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/live/streams">Open Public Streams</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
