import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings,
  User,
  MapPin,
  Bell,
  Lock,
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useState } from "react";

import { LibraryEmptyState } from "@/components/explore/library-empty-state";
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
import {
  PREMIUM_ACCOUNT_SEATS,
  premiumPlanCodeForAccount,
  premiumSuccessPathForAccount,
} from "@/lib/pricing-flow";
import {
  useBillingCheckoutMutation,
  useMeQuery,
  useUpdateMeProfileMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/library/settings")({
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { data: me, isLoading } = useMeQuery();
  const updateProfile = useUpdateMeProfileMutation();
  const checkout = useBillingCheckoutMutation();
  const [city, setCity] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [stateValue, setStateValue] = useState("");

  useEffect(() => {
    if (!me?.user) {
      return;
    }

    setCity(me.user.city ?? "");
    setDisplayName(me.user.displayName ?? "");
    setStateValue(me.user.state ?? "");
  }, [me]);

  const isSignedIn = Boolean(me?.user);
  const saveProfile = () => {
    updateProfile.mutate({
      city,
      displayName,
      state: stateValue,
    });
  };
  const startPremiumCheckout = async () => {
    if (!me?.user) {
      return;
    }

    try {
      setCheckoutMessage("");
      const { origin } = window.location;
      const response = await checkout.mutateAsync({
        cancelUrl: `${origin}/library/settings`,
        planCode: premiumPlanCodeForAccount(me.user.accountType),
        seats: PREMIUM_ACCOUNT_SEATS,
        successUrl: `${origin}${premiumSuccessPathForAccount(
          me.user.accountType
        )}?upgraded=1`,
      });

      if (response.checkoutUrl) {
        window.location.assign(response.checkoutUrl);
        return;
      }

      setCheckoutMessage(
        response.setupRequired
          ? "Premium checkout is being connected. You can keep using Free while billing is finished."
          : "Your account is already set for this plan."
      );
    } catch {
      setCheckoutMessage(
        "We could not open checkout right now. Please try again in a moment."
      );
    }
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Link to="/library" className="md:hidden">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 size-4" />
          Back to My SoundKit
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
          <Settings className="size-8 text-primary" />
          Account Settings
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Manage your account preferences
        </p>
      </div>

      {!isLoading && !isSignedIn ? (
        <LibraryEmptyState
          actionHref="/login"
          actionLabel="Log In"
          description="Log in to manage your SoundKit profile, location, notifications, and plan."
          icon={Settings}
          secondaryHref="/signup"
          secondaryLabel="Create Account"
          title="Log in to manage account settings"
        />
      ) : (
        <div className="max-w-3xl space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="How fans should see your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={me?.user.username ?? ""} readOnly />
              </div>
              <Button onClick={saveProfile} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Location Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5" />
                Location
              </CardTitle>
              <CardDescription>
                Set your location for personalized recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={stateValue}
                  onChange={(event) => setStateValue(event.target.value)}
                  placeholder="State"
                />
              </div>
              <Button onClick={saveProfile} disabled={updateProfile.isPending}>
                Update Location
              </Button>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Manage your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="new-music">New Music from Artists</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when artists release new tracks
                  </p>
                </div>
                <Switch id="new-music" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="battles">Live Battle Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notifications when battles are live
                  </p>
                </div>
                <Switch id="battles" defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="size-5" />
                Security
              </CardTitle>
              <CardDescription>
                Update your password and security settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline">Change Password</Button>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5" />
                Subscription
              </CardTitle>
              <CardDescription>Manage your subscription plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold">
                  Current Account: {me?.user.accountType ?? "Free"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Upgrade to unlock premium features
                </p>
              </div>
              <Button
                disabled={checkout.isPending}
                onClick={startPremiumCheckout}
              >
                {checkout.isPending
                  ? "Opening Checkout..."
                  : "Upgrade to Premium"}
              </Button>
              {checkoutMessage ? (
                <p className="text-sm text-muted-foreground">
                  {checkoutMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
