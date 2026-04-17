import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, FolderOpen, Plus, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard/music")({
  component: MusicPage,
});

function MusicPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
            My Music
          </h1>
          <p className="text-muted-foreground">
            Manage your tracks and projects
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/dashboard/tracks/new">
              <Plus className="size-4 mr-2" />
              New Track
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard/projects/new">
              <Plus className="size-4 mr-2" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tracks" className="w-full">
        <TabsList>
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                    <Music className="size-12 text-white/50" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play className="size-6 text-white" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">Track Title {i}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Released Jan 2025
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">
                        Mixed
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Mastered
                      </Badge>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/dashboard/tracks/${i}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="size-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="size-8 text-white/50" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Project Title {i}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {i % 2 === 0 ? "Album" : "EP"} •{" "}
                        {i % 2 === 0 ? "12" : "6"} tracks
                      </p>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline">
                          {i % 2 === 0 ? "Album" : "EP"}
                        </Badge>
                        <Badge variant="outline">In Progress</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="w-full bg-transparent"
                      >
                        <Link to={`/dashboard/projects/${i}`}>
                          View Project
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
