import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";

import { ProfileMediaUpload } from "@/components/dashboard/profile-media-upload";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/career/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account and profile settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Artist Profile</CardTitle>
              <CardDescription>
                This information will be displayed on your public profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <ProfileMediaUpload
                  description="Upload a cover image that frames your artist page. JPG or PNG up to 10MB."
                  kind="header"
                  title="Upload Header Image"
                />
                <ProfileMediaUpload
                  description="JPG or PNG up to 10MB. This image is stored in SoundKit media storage."
                  kind="avatar"
                  title="Upload Profile Photo"
                />
              </div>

              {/* Basic Info */}
              <div className="grid gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="artist-name">Artist Name *</Label>
                    <Input id="artist-name" defaultValue="John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                        mysoundkit.com/
                      </span>
                      <Input id="username" defaultValue="johndoe" required />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell people about yourself..."
                    defaultValue="Hip-hop producer and artist based in LA. Creating vibes since 2020."
                    rows={4}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="Los Angeles, CA"
                      defaultValue="Los Angeles, CA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genre">Primary Genre</Label>
                    <Input
                      id="genre"
                      placeholder="Hip-Hop"
                      defaultValue="Hip-Hop"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Music Platform Links</CardTitle>
              <CardDescription>
                Connect your music streaming profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="spotify">Spotify Artist URL</Label>
                <Input
                  id="spotify"
                  placeholder="https://open.spotify.com/artist/..."
                  type="url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apple-music">Apple Music Artist URL</Label>
                <Input
                  id="apple-music"
                  placeholder="https://music.apple.com/artist/..."
                  type="url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube">YouTube Channel URL</Label>
                <Input
                  id="youtube"
                  placeholder="https://youtube.com/@..."
                  type="url"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>
                Connect your social media accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input id="instagram" placeholder="@username" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter/X</Label>
                  <Input id="twitter" placeholder="@username" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok">TikTok</Label>
                  <Input id="tiktok" placeholder="@username" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soundcloud">SoundCloud</Label>
                  <Input id="soundcloud" placeholder="username" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>
              <Save className="size-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="account" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Manage your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" />
              </div>
              <Button variant="outline">Change Password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>Manage your subscription plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-semibold">Premium Plan</p>
                  <p className="text-sm text-muted-foreground">
                    $19/month • Renews on Feb 15, 2025
                  </p>
                </div>
                <Button variant="outline">Manage Plan</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose what emails you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  description: "Get notified when someone follows you",
                  title: "New Followers",
                },
                {
                  description: "Weekly summary of your track plays",
                  title: "Track Plays",
                },
                {
                  description:
                    "Get notified when someone comments on your tracks",
                  title: "Comments",
                },
                {
                  description: "Get notified about collaboration requests",
                  title: "Collaborations",
                },
                {
                  description: "Get notified when someone purchases your music",
                  title: "Sales",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{item.title}</Label>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Switch defaultChecked={i < 3} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Push Notifications</CardTitle>
              <CardDescription>
                Manage push notifications on your devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  description: "Get notified about new messages",
                  title: "Messages",
                },
                {
                  description: "Get notified when someone mentions you",
                  title: "Mentions",
                },
                {
                  description:
                    "Get notified about new releases from artists you follow",
                  title: "Releases",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{item.title}</Label>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Privacy</CardTitle>
              <CardDescription>
                Control who can see your profile and content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  description:
                    "Make your profile visible at mysoundkit.com/johndoe",
                  title: "Public Profile",
                },
                {
                  description: "Display number of tracks on your profile",
                  title: "Show Track Count",
                },
                {
                  description: "Display your follower count publicly",
                  title: "Show Followers",
                },
                {
                  description: "Display who you've collaborated with",
                  title: "Show Collaborators",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{item.title}</Label>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data & Privacy</CardTitle>
              <CardDescription>
                Manage your data and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Analytics Tracking</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow us to collect analytics data
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="pt-4 border-t">
                <Button variant="outline">Download My Data</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
