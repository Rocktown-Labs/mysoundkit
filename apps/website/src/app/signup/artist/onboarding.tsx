import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Music,
  User,
  MapPin,
  Users,
  Music2,
  LinkIcon,
  Share2,
  Check,
} from "lucide-react";
import { useState } from "react";

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

export const Route = createFileRoute("/signup/artist/onboarding")({
  component: ArtistOnboardingPage,
});

function ArtistOnboardingPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  const progress = (step / totalSteps) * 100;

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
            Set Up Your Artist Profile
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
                    This is how fans will find you
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="@yourartistname"
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

            {/* Step 2: Location */}
            {step === 2 && (
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
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Team Invites */}
            {step === 3 && (
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

            {/* Step 4: Genre */}
            {step === 4 && (
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
                  <Select>
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

            {/* Step 5: Streaming Links */}
            {step === 5 && (
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

            {/* Step 6: Social Links + Subscription */}
            {step === 6 && (
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
                    <Card className="border-2 cursor-pointer hover:border-primary transition-colors">
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
                    <Card className="border-2 border-primary cursor-pointer">
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
                    onClick={() => setStep(5)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Link to="/dashboard" className="flex-1">
                    <Button className="w-full" size="lg">
                      <Check className="mr-2 size-5" />
                      Complete Setup
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
