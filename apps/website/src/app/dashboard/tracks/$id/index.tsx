import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Download,
  Edit,
  Share2,
  Play,
  Music2,
  Mic,
  FileAudio,
  Disc,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data - would come from API
const mockTrack = {
  bpm: 140,
  collaborators: [
    {
      avatar: "/diverse-user-avatars.png",
      email: "user@soundkit.app",
      name: "John Doe",
      role: "Producer",
    },
    {
      avatar: "/diverse-user-avatars.png",
      email: "collab@soundkit.app",
      name: "Jane Smith",
      role: "Vocalist",
    },
  ],
  coverArt: "/summer-music-album-cover.png",
  createdAt: "2024-01-15",
  description: "A smooth summer track with laid-back vibes and catchy hooks.",
  files: {
    adlibs: [{ id: "1", name: "adlibs.wav", size: "8.5 MB", uploaded: true }],
    instrumental: {
      name: "summer-vibes-instrumental.wav",
      size: "45.2 MB",
      uploaded: true,
    },
    reference: { name: "reference.mp3", size: "8.2 MB", uploaded: true },
    session: { name: "summer-vibes.logicx", size: "2.1 GB", uploaded: true },
    verses: [
      { id: "1", name: "verse-1.wav", size: "12.3 MB", uploaded: true },
      { id: "2", name: "verse-2.wav", size: "11.8 MB", uploaded: true },
    ],
  },
  genre: "Hip-Hop",
  id: "1",
  isPublic: true,
  key: "C Major",
  name: "Summer Vibes",
  price: 29.99,
  status: "complete",
  updatedAt: "2 hours ago",
  variants: [
    { file: "summer-vibes-clean.wav", size: "42.1 MB", type: "clean" },
    { file: "summer-vibes-dirty.wav", size: "42.3 MB", type: "dirty" },
  ],
};

export const Route = createFileRoute("/dashboard/tracks/$id/")({
  component: TrackDetailPage,
});

function TrackDetailPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div
          className="w-full lg:w-64 h-64 rounded-lg bg-cover bg-center"
          style={{ backgroundImage: `url(${mockTrack.coverArt})` }}
        />
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold font-[family-name:var(--font-playfair)]">
                {mockTrack.name}
              </h1>
              <p className="text-muted-foreground">{mockTrack.genre}</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/dashboard/tracks/${id}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Button variant="outline">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                mockTrack.status === "complete" ? "default" : "secondary"
              }
            >
              {mockTrack.status}
            </Badge>
            {mockTrack.isPublic && <Badge variant="outline">Public</Badge>}
            {mockTrack.price > 0 && (
              <Badge variant="outline">${mockTrack.price}</Badge>
            )}
          </div>

          <p className="text-muted-foreground">{mockTrack.description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">BPM</p>
              <p className="text-lg font-semibold">{mockTrack.bpm}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Key</p>
              <p className="text-lg font-semibold">{mockTrack.key}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-lg font-semibold">{mockTrack.createdAt}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Updated</p>
              <p className="text-lg font-semibold">{mockTrack.updatedAt}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="files" className="w-full">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborators</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          {/* Instrumental */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music2 className="h-5 w-5" />
                Instrumental
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-accent/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {mockTrack.files.instrumental.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {mockTrack.files.instrumental.size}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Verses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockTrack.files.verses.map((verse, index) => (
                <div
                  key={verse.id}
                  className="flex items-center justify-between p-3 bg-accent/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileAudio className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Verse {index + 1}</p>
                      <p className="text-sm text-muted-foreground">
                        {verse.size}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Variants */}
          {mockTrack.variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Disc className="h-5 w-5" />
                  Track Variants
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {mockTrack.variants.map((variant) => (
                  <div
                    key={variant.type}
                    className="flex items-center justify-between p-3 bg-accent/20 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileAudio className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {variant.type.toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {variant.size}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="collaborators" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Collaborators</CardTitle>
              <CardDescription>People working on this track</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockTrack.collaborators.map((collab) => (
                <div
                  key={collab.email}
                  className="flex items-center justify-between p-3 bg-accent/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={collab.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{collab.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{collab.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {collab.role}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Read & Write</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">No recent activity</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
