import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCreateWorkspaceInvitationMutation,
  useMeEntitlementsQuery,
  useWorkspaceQuery,
} from "@/lib/soundkit-api-hooks";

export function PremiumWorkspaceInviteCard({
  accountType,
}: {
  accountType: "artist" | "fan";
}) {
  const entitlements = useMeEntitlementsQuery(),
    workspace = useWorkspaceQuery(),
    invite = useCreateWorkspaceInvitationMutation(),
    [email, setEmail] = useState(""),
    [skipped, setSkipped] = useState(false),
    [message, setMessage] = useState("");

  if (
    !entitlements.data?.isPremium ||
    skipped ||
    !workspace.data?.activeWorkspace
  ) {
    return null;
  }

  const { total } = workspace.data.seats,
    { used } = workspace.data.seats,
    canInvite = used + workspace.data.invitations.length < total;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle>Invite people to your Premium workspace</CardTitle>
        <CardDescription>
          {accountType === "artist"
            ? "Invite a manager, producer, engineer, or team member."
            : "Invite a family or household member with their own account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {used} of {total} used
        </p>
        {canInvite ? (
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage("");
              invite.mutate(
                { email, role: "member" },
                {
                  onError: (error) => setMessage(error.message),
                  onSuccess: () => {
                    setEmail("");
                    setMessage("Invitation sent.");
                  },
                }
              );
            }}
          >
            <input
              aria-label="Email address to invite"
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
            <Button disabled={invite.isPending} type="submit">
              {invite.isPending ? "Sending…" : "Send invite"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            All Premium seats are currently used or pending.
          </p>
        )}
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
        <Button onClick={() => setSkipped(true)} variant="ghost">
          Skip for now
        </Button>
      </CardContent>
    </Card>
  );
}
