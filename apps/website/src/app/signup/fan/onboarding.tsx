import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, User, MapPin, Music2, Check } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/signup/fan/onboarding")({
  component: FanOnboardingPage,
});

function FanOnboardingPage() {
  const [step, setStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const totalSteps = 4;

  const progress = (step / totalSteps) * 100;

  const genres = [
    "Hip-Hop",
    "R&B/Soul",
    "Pop",
    "Electronic",
    "Rock",
    "Jazz",
    "Afrobeats",
    "Latin",
    "Country",
    "Reggae",
    "Indie",
    "Metal",
  ];

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Music className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold font-notable">SoundKit</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            Personalize Your Experience
          </h1>
          <p className="text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
          <Progress value={progress} className="mt-4 h-2" />
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/40">
          <CardContent className="p-6 md:p-8">
            {/* Step 1: Username */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Choose Your Username</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    How you'll appear to others
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="@musicfan"
                    className="text-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Can only contain letters, numbers, and underscores
                  </p>
                </div>
                <Button onClick={() => setStep(2)} className="w-full" size="lg">
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2: Genre Preferences */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Music2 className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">
                    What Do You Like to Listen To?
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Select at least 3 genres
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {genres.map((genre) => (
                    <Badge
                      key={genre}
                      variant={
                        selectedGenres.includes(genre) ? "default" : "outline"
                      }
                      className="cursor-pointer text-sm py-2 px-4"
                      onClick={() => toggleGenre(genre)}
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    className="flex-1"
                    size="lg"
                    disabled={selectedGenres.length < 3}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Where Are You Located?</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Discover local artists and events
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Los Angeles" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select>
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

            {/* Step 4: Subscription */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">Choose Your Plan</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    You can always upgrade later
                  </p>
                </div>
                <div className="grid gap-4">
                  <Card className="border-2 cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-bold text-lg">Free</h4>
                          <p className="text-3xl font-bold mt-2">
                            $0
                            <span className="text-sm font-normal text-muted-foreground">
                              /month
                            </span>
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center">
                          <Check className="mr-2 size-4 text-primary" />
                          Stream unlimited music
                        </li>
                        <li className="flex items-center">
                          <Check className="mr-2 size-4 text-primary" />
                          Vote in battles
                        </li>
                        <li className="flex items-center">
                          <Check className="mr-2 size-4 text-primary" />
                          Create playlists
                        </li>
                      </ul>
                      <Link to="/explore">
                        <Button
                          variant="outline"
                          className="w-full mt-6 bg-transparent"
                          size="lg"
                        >
                          Start Free
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary cursor-pointer relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                      RECOMMENDED
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-bold text-lg">Premium</h4>
                          <p className="text-3xl font-bold mt-2">
                            $4.99
                            <span className="text-sm font-normal text-muted-foreground">
                              /month
                            </span>
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center">
                          <Check className="mr-2 size-4 text-primary" />
                          Everything in Free
                        </li>
                        <li className="flex items-center">
                          <Check className="mr-2 size-4 text-primary" />
                          Ad-free listening
                        </li>
                        <li className="flex items-center">
                          <Check className="mr-2 size-4 text-primary" />
                          High-quality audio
                        </li>
                        <li className="flex items-center">
                          <Check className="mr-2 size-4 text-primary" />
                          Offline downloads
                        </li>
                        <li className="flex items-center">
                          <Check className="mr-2 size-4 text-primary" />
                          Early access to battles
                        </li>
                      </ul>
                      <Link to="/explore">
                        <Button className="w-full mt-6" size="lg">
                          Start Premium
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
                <Button
                  onClick={() => setStep(3)}
                  variant="ghost"
                  className="w-full"
                >
                  Back
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
