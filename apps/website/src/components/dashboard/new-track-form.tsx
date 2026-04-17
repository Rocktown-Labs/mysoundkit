import { useRouter } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface TrackFormData {
  name: string;
  genre: string;
  description: string;
  bpm: string;
  key: string;
  productionStatus: "demo" | "mixed" | "mastered" | "complete";
  coverArt?: File;
  isForSale: boolean;
  price: string;
  isPublic: boolean;
}

interface VerseFile {
  id: string;
  verseNumber: number;
  file: File | null;
  uploaded: boolean;
}

interface TrackVariant {
  id: string;
  type: "clean" | "dirty" | "acapella";
  files: {
    instrumental?: File;
    verses: VerseFile[];
    adlibs: File[];
  };
}

export function NewTrackForm({
  isEditing = false,
  trackId,
}: {
  isEditing?: boolean;
  trackId?: string;
}) {
  const router = useRouter();
  const [formData, setFormData] = useState<TrackFormData>({
    bpm: "",
    description: "",
    genre: "",
    isForSale: false,
    isPublic: true,
    key: "",
    name: "",
    price: "",
    productionStatus: "demo",
  });

  const [verses, setVerses] = useState<VerseFile[]>([
    { file: null, id: "1", uploaded: false, verseNumber: 1 },
  ]);
  const [adlibs, setAdlibs] = useState<File[]>([]);
  const [variants, setVariants] = useState<TrackVariant[]>([]);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");

  const handleInputChange = (field: keyof TrackFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addVerse = () => {
    const newVerseNumber = verses.length + 1;
    setVerses([
      ...verses,
      {
        file: null,
        id: Date.now().toString(),
        uploaded: false,
        verseNumber: newVerseNumber,
      },
    ]);
  };

  const removeVerse = (id: string) => {
    if (verses.length > 1) {
      setVerses(verses.filter((v) => v.id !== id));
    }
  };

  const addVariant = (type: "clean" | "dirty" | "acapella") => {
    setVariants([
      ...variants,
      {
        files: {
          adlibs: [],
          verses: [{ file: null, id: "1", uploaded: false, verseNumber: 1 }],
        },
        id: Date.now().toString(),
        type,
      },
    ]);
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
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    router.navigate({ to: "/dashboard/tracks" });
  };

  const isFormValid =
    formData.name.trim() !== "" && formData.genre.trim() !== "";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Track Details
          </CardTitle>
          <CardDescription>Basic information about your track</CardDescription>
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
                Track Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter track name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="bg-input/50 border-border/60 focus:border-primary"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="genre">
                Genre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="genre"
                placeholder="e.g., Hip-Hop, R&B, Pop"
                value={formData.genre}
                onChange={(e) => handleInputChange("genre", e.target.value)}
                className="bg-input/50 border-border/60 focus:border-primary"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your track..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="bg-input/50 border-border/60 focus:border-primary min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bpm">BPM</Label>
              <Input
                id="bpm"
                type="number"
                placeholder="120"
                value={formData.bpm}
                onChange={(e) => handleInputChange("bpm", e.target.value)}
                className="bg-input/50 border-border/60 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="C Major"
                value={formData.key}
                onChange={(e) => handleInputChange("key", e.target.value)}
                className="bg-input/50 border-border/60 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Production Status</Label>
              <Select
                value={formData.productionStatus}
                onValueChange={(value: any) =>
                  handleInputChange("productionStatus", value)
                }
              >
                <SelectTrigger className="bg-input/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="mastered">Mastered</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Public Track</Label>
                <p className="text-sm text-muted-foreground">
                  Make this track visible on your profile
                </p>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) =>
                  handleInputChange("isPublic", checked.toString())
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sell This Track</Label>
                <p className="text-sm text-muted-foreground">
                  Allow others to purchase this track
                </p>
              </div>
              <Switch
                checked={formData.isForSale}
                onCheckedChange={(checked) =>
                  handleInputChange("isForSale", checked.toString())
                }
              />
            </div>

            {formData.isForSale && (
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="29.99"
                  value={formData.price}
                  onChange={(e) => handleInputChange("price", e.target.value)}
                  className="bg-input/50 border-border/60 focus:border-primary"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Track Files
          </CardTitle>
          <CardDescription>Upload your track components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instrumental */}
          <div className="space-y-2">
            <Label>Instrumental</Label>
            <FileUploadZone
              title="Upload Instrumental"
              description="WAV, MP3, AIFF"
              acceptedTypes=".wav,.mp3,.aiff"
              onFileUpload={(files) => console.log("Instrumental:", files)}
            />
          </div>

          {/* Verses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Verse Vocals</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVerse}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Verse
              </Button>
            </div>
            {verses.map((verse, index) => (
              <div key={verse.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <FileUploadZone
                    title={`Verse ${verse.verseNumber}`}
                    description="WAV, MP3, AIFF"
                    acceptedTypes=".wav,.mp3,.aiff"
                    onFileUpload={(files) =>
                      console.log(`Verse ${verse.verseNumber}:`, files)
                    }
                  />
                </div>
                {verses.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVerse(verse.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Adlibs */}
          <div className="space-y-2">
            <Label>Adlibs (Optional)</Label>
            <FileUploadZone
              title="Upload Adlibs"
              description="Can be tagged to specific verses"
              acceptedTypes=".wav,.mp3,.aiff"
              onFileUpload={(files) => console.log("Adlibs:", files)}
              optional
            />
          </div>

          {/* Session File */}
          <div className="space-y-2">
            <Label>Session File (Optional)</Label>
            <FileUploadZone
              title="Upload Session File"
              description="Logic Pro X, Studio One, etc."
              acceptedTypes=".logicx,.studio1,.ptx"
              onFileUpload={(files) => console.log("Session:", files)}
              optional
            />
          </div>

          {/* Reference Track */}
          <div className="space-y-2">
            <Label>Reference Track (Optional)</Label>
            <FileUploadZone
              title="Upload Reference"
              description="WAV, MP3, AIFF"
              acceptedTypes=".wav,.mp3,.aiff"
              onFileUpload={(files) => console.log("Reference:", files)}
              optional
            />
          </div>
        </CardContent>
      </Card>

      {/* Track Variants */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Track Variants
          </CardTitle>
          <CardDescription>
            Create clean, dirty, or acapella versions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addVariant("clean")}
            >
              <Plus className="h-4 w-4 mr-1" />
              Clean Version
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addVariant("dirty")}
            >
              <Plus className="h-4 w-4 mr-1" />
              Dirty Version
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addVariant("acapella")}
            >
              <Plus className="h-4 w-4 mr-1" />
              Acapella
            </Button>
          </div>
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="p-4 border border-border/40 rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{variant.type.toUpperCase()}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setVariants(variants.filter((v) => v.id !== variant.id))
                  }
                >
                  Remove
                </Button>
              </div>
              <FileUploadZone
                title={`${variant.type} version files`}
                description="Upload variant files"
                acceptedTypes=".wav,.mp3,.aiff"
                onFileUpload={(files) => console.log(`${variant.type}:`, files)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Collaborators */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Collaborators
          </CardTitle>
          <CardDescription>
            Invite others to collaborate on this track
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
          {isEditing ? "Update Track" : "Create Track"}
        </Button>
      </div>
    </form>
  );
}
