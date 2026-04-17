import { useRouter } from "@tanstack/react-router";
import { Plus, X, Music, ImageIcon, Video } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { FileUploadZone } from "@/components/dashboard/file-upload-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ProjectFormData {
  name: string;
  type: "album" | "ep";
  description: string;
  releaseDate: string;
  coverArt?: File;
}

interface SelectedTrack {
  id: string;
  name: string;
  genre: string;
  duration: string;
}

const mockTracks: SelectedTrack[] = [
  { duration: "3:24", genre: "Hip-Hop", id: "1", name: "Summer Vibes" },
  { duration: "4:12", genre: "R&B", id: "2", name: "Night Drive" },
  { duration: "3:45", genre: "Pop", id: "3", name: "City Lights" },
  { duration: "3:58", genre: "Hip-Hop", id: "4", name: "Midnight Dreams" },
];

export function NewProjectForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<ProjectFormData>({
    description: "",
    name: "",
    releaseDate: "",
    type: "album",
  });

  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [mediaFiles, setMediaFiles] = useState<{
    photos: File[];
    videos: File[];
  }>({ photos: [], videos: [] });

  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTrack = (trackId: string) => {
    setSelectedTracks((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  const addCollaborator = () => {
    if (collaboratorEmail && !collaborators.includes(collaboratorEmail)) {
      setCollaborators([...collaborators, collaboratorEmail]);
      setCollaboratorEmail("");
    }
  };

  const removeCollaborator = (email: string) => {
    setCollaborators(collaborators.filter((c) => c !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    router.navigate({ to: "/dashboard/projects" });
  };

  const maxTracks = formData.type === "ep" ? 6 : Number.POSITIVE_INFINITY;
  const canAddMoreTracks = selectedTracks.length < maxTracks;
  const isFormValid = formData.name.trim() !== "" && selectedTracks.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Project Details
          </CardTitle>
          <CardDescription>
            Basic information about your album or EP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cover Art */}
          <div className="space-y-2">
            <Label>Cover Art (Optional)</Label>
            <FileUploadZone
              title="Upload Cover Art"
              description="PNG, JPG up to 10MB"
              acceptedTypes=".png,.jpg,.jpeg"
              onFileUpload={(files) => {
                if (files[0]) {
                  setFormData((prev) => ({ ...prev, coverArt: files[0] }));
                }
              }}
              optional
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter project name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="bg-input/50 border-border/60 focus:border-primary"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">
                Project Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => handleInputChange("type", value)}
              >
                <SelectTrigger className="bg-input/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ep">EP (Max 6 tracks)</SelectItem>
                  <SelectItem value="album">Album</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your project..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="bg-input/50 border-border/60 focus:border-primary min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="releaseDate">Release Date (Optional)</Label>
            <Input
              id="releaseDate"
              type="date"
              value={formData.releaseDate}
              onChange={(e) => handleInputChange("releaseDate", e.target.value)}
              className="bg-input/50 border-border/60 focus:border-primary"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-[family-name:var(--font-playfair)]">
                Select Tracks
              </CardTitle>
              <CardDescription>
                Choose existing tracks or create new ones
                {formData.type === "ep" &&
                  ` (${selectedTracks.length}/6 selected)`}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.navigate({ to: "/dashboard/tracks/new" })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create New Track
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockTracks.map((track) => {
            const isSelected = selectedTracks.includes(track.id);
            const isDisabled = !isSelected && !canAddMoreTracks;

            return (
              <div
                key={track.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : (isDisabled
                      ? "border-border/40 bg-muted/20 opacity-50"
                      : "border-border/40 bg-background/50 hover:border-primary/50")
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleTrack(track.id)}
                    disabled={isDisabled}
                  />
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <Music className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{track.name}</div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {track.genre}
                      </Badge>
                      <span>{track.duration}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {selectedTracks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tracks selected yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-[family-name:var(--font-playfair)]">
                Additional Media
              </CardTitle>
              <CardDescription>
                Add photos and videos to your project
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              Premium
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Photos</Label>
            <FileUploadZone
              title="Upload Photos"
              description="Behind-the-scenes, promotional images"
              acceptedTypes=".png,.jpg,.jpeg"
              onFileUpload={(files) => {
                setMediaFiles((prev) => ({
                  ...prev,
                  photos: [...prev.photos, ...[...files]],
                }));
              }}
              optional
            />
          </div>

          <div className="space-y-2">
            <Label>Videos</Label>
            <FileUploadZone
              title="Upload Videos"
              description="Music videos, social media content (MP4, MOV, MKV)"
              acceptedTypes=".mp4,.mov,.mkv"
              onFileUpload={(files) => {
                setMediaFiles((prev) => ({
                  ...prev,
                  videos: [...prev.videos, ...[...files]],
                }));
              }}
              optional
            />
          </div>

          {(mediaFiles.photos.length > 0 || mediaFiles.videos.length > 0) && (
            <div className="pt-4 border-t border-border/40">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {mediaFiles.photos.length > 0 && (
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    <span>{mediaFiles.photos.length} photo(s)</span>
                  </div>
                )}
                {mediaFiles.videos.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <span>{mediaFiles.videos.length} video(s)</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collaborators */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Collaborators
          </CardTitle>
          <CardDescription>
            Invite others to collaborate on this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address"
              value={collaboratorEmail}
              onChange={(e) => setCollaboratorEmail(e.target.value)}
              className="bg-input/50 border-border/60"
            />
            <Button type="button" onClick={addCollaborator}>
              Add
            </Button>
          </div>
          {collaborators.length > 0 && (
            <div className="space-y-2">
              {collaborators.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-2 bg-accent/20 rounded-lg"
                >
                  <span className="text-sm">{email}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCollaborator(email)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.history.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isFormValid}
          className="bg-primary hover:bg-primary/90"
        >
          Create Project
        </Button>
      </div>
    </form>
  );
}
