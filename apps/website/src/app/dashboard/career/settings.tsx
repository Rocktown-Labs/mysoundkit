import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import type React from "react";

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
import {
  useMeEntitlementsQuery,
  useMeQuery,
  useUpdateMeProfileMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const meQuery = useMeQuery();
  const entitlementsQuery = useMeEntitlementsQuery();
  const updateProfile = useUpdateMeProfileMutation();
  const user = meQuery.data?.user;
  const entitlements = entitlementsQuery.data;
  const location = [user?.city, user?.state].filter(Boolean).join(", ");
  const [isDirty, setIsDirty] = useState(false);
  const [bioLength, setBioLength] = useState(user?.bio?.length ?? 0);

  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateProfile.mutate(
      {
        bio: String(form.get("bio") ?? ""),
        city: String(form.get("city") ?? ""),
        displayName: String(form.get("displayName") ?? ""),
        links: {
          appleMusic: String(form.get("appleMusic") ?? ""),
          instagram: String(form.get("instagram") ?? ""),
          personalSite: String(form.get("personalSite") ?? ""),
          soundcloud: String(form.get("soundcloud") ?? ""),
          spotify: String(form.get("spotify") ?? ""),
          tiktok: String(form.get("tiktok") ?? ""),
          twitter: String(form.get("twitter") ?? ""),
          youtube: String(form.get("youtube") ?? ""),
        },
        proAffiliation: String(form.get("proAffiliation") ?? "None"),
        proMemberId: String(form.get("proMemberId") ?? ""),
        songwriterLegalName: String(form.get("songwriterLegalName") ?? ""),
        stageName: String(form.get("stageName") ?? ""),
        state: String(form.get("state") ?? ""),
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          toast({
            description: "Your profile changes have been saved.",
            title: "Profile Saved",
          });
        },
      }
    );
  };

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

        <TabsContent value="profile" className="mt-6">
          <form
            className="space-y-6"
            onSubmit={saveProfile}
            onChange={() => setIsDirty(true)}
            key={user?.id}
          >
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
                      <Label htmlFor="artist-name">
                        Artist Name / Display Name *
                      </Label>
                      <Input
                        id="artist-name"
                        name="displayName"
                        defaultValue={user?.displayName ?? ""}
                        placeholder="Your artist name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stage-name">
                        Stage Name / Performance Alias
                      </Label>
                      <Input
                        id="stage-name"
                        name="stageName"
                        defaultValue={
                          user?.stageName ?? user?.displayName ?? ""
                        }
                        placeholder="e.g. MC Supreme, DJ Shadow"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      placeholder="Tell people about yourself..."
                      defaultValue={user?.bio ?? ""}
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        name="city"
                        placeholder="Los Angeles"
                        defaultValue={user?.city ?? ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        name="state"
                        placeholder="CA"
                        defaultValue={user?.state ?? ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-preview">Public Location</Label>
                      <Input
                        id="location-preview"
                        value={location}
                        readOnly
                        placeholder="Shown after city/state are saved"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credits & Publishing</CardTitle>
                <CardDescription>
                  Keep writer credits and royalty registration details ready
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="songwriterLegalName">
                      Songwriter / Legal Name
                    </Label>
                    <Input
                      id="songwriterLegalName"
                      name="songwriterLegalName"
                      defaultValue={user?.songwriterLegalName ?? ""}
                      placeholder="Cameron Stewart"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proAffiliation">ASCAP / BMI</Label>
                    <Input
                      id="proAffiliation"
                      name="proAffiliation"
                      defaultValue={user?.proAffiliation ?? "None"}
                      placeholder="BMI"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proMemberId">PRO Number</Label>
                    <Input
                      id="proMemberId"
                      name="proMemberId"
                      defaultValue={user?.proMemberId ?? ""}
                      placeholder="Writer member number"
                    />
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
                    name="spotify"
                    defaultValue={user?.links?.spotify ?? ""}
                    placeholder="@artist or https://open.spotify.com/artist/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apple-music">Apple Music Artist URL</Label>
                  <Input
                    id="apple-music"
                    name="appleMusic"
                    defaultValue={user?.links?.appleMusic ?? ""}
                    placeholder="@artist or https://music.apple.com/artist/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube Channel URL</Label>
                  <Input
                    id="youtube"
                    name="youtube"
                    defaultValue={user?.links?.youtube ?? ""}
                    placeholder="@channel or https://youtube.com/@..."
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
                    <Input
                      id="instagram"
                      name="instagram"
                      defaultValue={user?.links?.instagram ?? ""}
                      placeholder="@username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter/X</Label>
                    <Input
                      id="twitter"
                      name="twitter"
                      defaultValue={user?.links?.twitter ?? ""}
                      placeholder="@username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok">TikTok</Label>
                    <Input
                      id="tiktok"
                      name="tiktok"
                      defaultValue={user?.links?.tiktok ?? ""}
                      placeholder="@username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="soundcloud">SoundCloud</Label>
                    <Input
                      id="soundcloud"
                      name="soundcloud"
                      defaultValue={user?.links?.soundcloud ?? ""}
                      placeholder="username"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="personal-site">Personal Site</Label>
                    <Input
                      id="personal-site"
                      name="personalSite"
                      defaultValue={user?.links?.personalSite ?? ""}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              {updateProfile.isSuccess && (
                <p className="self-center text-sm text-muted-foreground">
                  Profile saved.
                </p>
              )}
              <Button variant="outline" type="reset">
                Cancel
              </Button>
              <Button type="submit" disabled={!isDirty || updateProfile.isPending}>
                <Save className="size-4 mr-2" />
                {updateProfile.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
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
                  placeholder="Managed by your sign-in provider"
                  disabled
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
              <CardDescription>
                Current capabilities from your SoundKit entitlements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-semibold">
                    {entitlements?.activePlanCode ?? "No active paid plan"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {entitlements?.status ?? "Using available free features"}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <a href="/pricing">Manage Plan</a>
                </Button>
              </div>
              {entitlements && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Capability enabled={entitlements.canCreateLiveBattles}>
                    Create battles
                  </Capability>
                  <Capability enabled={entitlements.canHostLiveStreams}>
                    Host streams
                  </Capability>
                  <Capability enabled={entitlements.canSellProducts}>
                    Sell products
                  </Capability>
                  <Capability enabled={entitlements.canReceivePayouts}>
                    Receive payouts
                  </Capability>
                </div>
              )}
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

function Capability({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background/40 px-3 py-2 text-sm">
      <span>{children}</span>
      <span className={enabled ? "text-emerald-500" : "text-muted-foreground"}>
        {enabled ? "Enabled" : "Off"}
      </span>
    </div>
  );
}
