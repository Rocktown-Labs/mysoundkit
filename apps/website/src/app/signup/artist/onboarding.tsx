/* eslint-disable no-use-before-define, react-perf/jsx-no-new-function-as-prop, react/no-unescaped-entities */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  User,
  MapPin,
  Users,
  Music2,
  LinkIcon,
  Share2,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";

import { SoundKitBrand } from "@/components/soundkit-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_V1_URL } from "@/lib/api";

type ArtistRole = "musician" | "producer";

export const Route = createFileRoute("/signup/artist/onboarding")({
  component: ArtistOnboardingPage,
});

function ArtistOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [roles, setRoles] = useState<ArtistRole[]>(["musician"]);
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [primaryGenre, setPrimaryGenre] = useState("");
  const [selectedPlanCode, setSelectedPlanCode] = useState("artist_lite_ads");
  const totalSteps = 7;

  const progress = (step / totalSteps) * 100;
  const toggleRole = (role: ArtistRole) => {
    setRoles((currentRoles) => {
      if (currentRoles.includes(role) && currentRoles.length > 1) {
        return currentRoles.filter((currentRole) => currentRole !== role);
      }

      if (currentRoles.includes(role)) {
        return currentRoles;
      }

      return [...currentRoles, role];
    });
  };
  const completeOnboarding = async () => {
    try {
      await fetch(`${API_V1_URL}/onboarding/artist`, {
        body: JSON.stringify({
          city: city || "Los Angeles",
          primaryGenre: primaryGenre || "Hip-Hop",
          roles,
          selectedPlanCode,
          state: stateValue || "ca",
          teamInviteEmails: [],
          username: username || "soundkit-artist",
        }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    } catch {
      // The mock onboarding UI still advances when the API is offline.
    }

    router.navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <SoundKitBrand
            className="mb-4"
            variant="wordmark"
            wordmarkClassName="h-12"
          />
          <h1 className="text-2xl font-bold mb-2">
            Set Up Your Artist Profile
          </h1>
          <p className="text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
          <Progress value={progress} className="mt-4 h-2" />
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/40">
          <CardContent className="p-6 md:p-8">
            {/* Step 1: Artist Roles */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <SlidersHorizontal className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">What Do You Create?</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Choose one or both. The dashboard stays the same.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    className={`rounded-lg border p-4 text-left transition ${
                      roles.includes("musician")
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/50"
                    }`}
                    onClick={() => toggleRole("musician")}
                  >
                    <Music2 className="mb-3 size-6 text-primary" />
                    <p className="font-bold">Musician</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Release songs, albums, EPs, videos, and battle tracks.
                    </p>
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border p-4 text-left transition ${
                      roles.includes("producer")
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/50"
                    }`}
                    onClick={() => toggleRole("producer")}
                  >
                    <SlidersHorizontal className="mb-3 size-6 text-primary" />
                    <p className="font-bold">Producer</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sell or stream beats, license instrumentals, and battle.
                    </p>
                  </button>
                </div>
                <Button onClick={() => setStep(2)} className="w-full" size="lg">
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2: Username */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Choose Your Username</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    This is how fans will find you
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="@yourartistname"
                    className="text-lg"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Can only contain letters, numbers, and underscores
                  </p>
                </div>
                <Button onClick={() => setStep(3)} className="w-full" size="lg">
                  Continue
                </Button>
              </div>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">
                    Where Do You Make Music?
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Help fans discover local talent
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Los Angeles"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select value={stateValue} onValueChange={setStateValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ca">California</SelectItem>
                        <SelectItem value="ny">New York</SelectItem>
                        <SelectItem value="tx">Texas</SelectItem>
                        <SelectItem value="ga">Georgia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(4)}
                    className="flex-1"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Team Invites */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Invite Your Team</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Collaborate with producers, managers, and more
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email1">Team Member Email</Label>
                    <Input
                      id="email1"
                      type="email"
                      placeholder="producer@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">Team Member Email</Label>
                    <Input
                      id="email2"
                      type="email"
                      placeholder="manager@example.com"
                    />
                  </div>
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  + Add Another
                </Button>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(3)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(5)}
                    className="flex-1"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Genre */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Music2 className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">What's Your Genre?</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Help fans find your style
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="genre">Primary Genre</Label>
                  <Select value={primaryGenre} onValueChange={setPrimaryGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                      <SelectItem value="rb">R&B/Soul</SelectItem>
                      <SelectItem value="pop">Pop</SelectItem>
                      <SelectItem value="electronic">Electronic</SelectItem>
                      <SelectItem value="rock">Rock</SelectItem>
                      <SelectItem value="afrobeats">Afrobeats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(4)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(6)}
                    className="flex-1"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Streaming Links */}
            {step === 6 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <LinkIcon className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Connect Your Music</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Link your streaming profiles (optional)
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="spotify">Spotify Artist URL</Label>
                    <Input
                      id="spotify"
                      placeholder="https://open.spotify.com/artist/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apple">Apple Music URL</Label>
                    <Input
                      id="apple"
                      placeholder="https://music.apple.com/artist/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="youtube">YouTube Channel URL</Label>
                    <Input
                      id="youtube"
                      placeholder="https://youtube.com/@..."
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(5)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(7)}
                    className="flex-1"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 7: Social Links + Subscription */}
            {step === 7 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Share2 className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Connect Your Socials</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Link your social media (optional)
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input id="instagram" placeholder="@yourhandle" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok">TikTok</Label>
                    <Input id="tiktok" placeholder="@yourhandle" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">X (Twitter)</Label>
                    <Input id="twitter" placeholder="@yourhandle" />
                  </div>
                </div>

                {/* Subscription Choice */}
                <div className="border-t pt-6 mt-6">
                  <h3 className="font-bold text-lg mb-4">Choose Your Plan</h3>
                  <div className="grid gap-4">
                    <Card
                      className="border-2 cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setSelectedPlanCode("artist_free")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Free Account</h4>
                            <p className="text-sm text-muted-foreground">
                              Basic features to get started
                            </p>
                          </div>
                          <span className="font-bold">$0/mo</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card
                      className="border-2 border-primary cursor-pointer"
                      onClick={() => setSelectedPlanCode("artist_lite_ads")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              Premium
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                Recommended
                              </span>
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Unlimited uploads, analytics, and more
                            </p>
                          </div>
                          <span className="font-bold">$9.99/mo</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(6)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() => void completeOnboarding()}
                  >
                    <Check className="mr-2 size-5" />
                    Complete Setup
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
