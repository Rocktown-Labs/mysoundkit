"use client";

import { createFileRoute } from "@tanstack/react-router";
import {
  Mail,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
  UserPlus,
} from "lucide-react";
import { useState } from "react";

import { InviteMemberDialog } from "@/components/dashboard/team/invite-member-dialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  useRemoveWorkspaceMemberMutation,
  useRevokeWorkspaceInvitationMutation,
  useUpdateWorkspaceMutation,
  useWorkspaceQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/team")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { toast } = useToast(),
    workspaceQuery = useWorkspaceQuery(),
    updateMutation = useUpdateWorkspaceMutation(),
    removeMemberMutation = useRemoveWorkspaceMemberMutation(),
    revokeInvitationMutation = useRevokeWorkspaceInvitationMutation(),
    [isInviteOpen, setIsInviteOpen] = useState(false),
    [isRenameOpen, setIsRenameOpen] = useState(false),
    [newName, setNewName] = useState(""),
    workspace = workspaceQuery.data,
    activeWorkspace = workspace?.activeWorkspace,
    canManage =
      activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin",
    rename = async () => {
      if (!newName.trim()) {
        return;
      }
      try {
        await updateMutation.mutateAsync({ name: newName.trim() });
        setIsRenameOpen(false);
        toast({
          description: "Workspace name updated.",
          title: "Workspace updated",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Unable to rename workspace.",
          title: "Rename failed",
          variant: "destructive",
        });
      }
    },
    removeMember = async (memberId: string) => {
      try {
        await removeMemberMutation.mutateAsync(memberId);
        toast({
          description: "The member was removed from the workspace.",
          title: "Member removed",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error ? error.message : "Unable to remove member.",
          title: "Removal failed",
          variant: "destructive",
        });
      }
    },
    revokeInvitation = async (invitationId: string) => {
      try {
        await revokeInvitationMutation.mutateAsync(invitationId);
        toast({
          description: "The invitation was revoked.",
          title: "Invitation revoked",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Unable to revoke invitation.",
          title: "Revoke failed",
          variant: "destructive",
        });
      }
    };
  if (workspaceQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading workspace…
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Workspace
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage account access, members, roles, and workspace settings.
          </p>
        </div>
        {canManage && (
          <Button
            disabled={
              !workspace ||
              workspace.seats.used + workspace.invitations.length >=
                workspace.seats.total
            }
            onClick={() => setIsInviteOpen(true)}
          >
            <UserPlus className="mr-2 size-4" />
            Invite Member
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workspace</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="size-5 text-primary" />
              {workspace?.activeWorkspace ? "1" : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {activeWorkspace?.name ?? "No active workspace"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Seats Used</CardDescription>
            <CardTitle className="text-2xl">
              {workspace?.seats.used ?? 0} / {workspace?.seats.total ?? 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Persisted subscription seats
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Invites</CardDescription>
            <CardTitle className="text-2xl">
              {workspace?.invitations.length ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Real organization invitations
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your Role</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="size-5 text-primary" />
              {activeWorkspace?.role ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Workspace access
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Workspace Identity</CardTitle>
            <CardDescription>
              Account access is separate from social relationships and music
              credits.
            </CardDescription>
          </div>
          {canManage && (
            <Button
              onClick={() => {
                setNewName(activeWorkspace?.name ?? "");
                setIsRenameOpen(true);
              }}
              size="sm"
              variant="outline"
            >
              <Pencil className="mr-2 size-3.5" />
              Rename
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {activeWorkspace ? (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-semibold">{activeWorkspace.name}</p>
                <p className="text-xs text-muted-foreground">
                  /{activeWorkspace.slug} · {activeWorkspace.workspaceType}
                </p>
              </div>
              <Badge>{activeWorkspace.role}</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active workspace is available.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Only real Better Auth organization members appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspace?.members.length ? (
            <div className="divide-y rounded-lg border">
              {workspace.members.map((member) => (
                <div
                  className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  key={member.id}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {member.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.isOwner ? "default" : "outline"}>
                      {member.isOwner ? "Owner" : member.role}
                    </Badge>
                    {canManage && !member.isOwner && (
                      <Button
                        disabled={removeMemberMutation.isPending}
                        onClick={() => void removeMember(member.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="mr-1 size-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No workspace members found.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Invitations are persisted in Better Auth and can be revoked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspace?.invitations.length ? (
            <div className="divide-y rounded-lg border">
              {workspace.invitations.map((invitation) => (
                <div
                  className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  key={invitation.id}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="size-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {invitation.role ?? "member"} · Expires{" "}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      disabled={revokeInvitationMutation.isPending}
                      onClick={() => void revokeInvitation(invitation.id)}
                      size="sm"
                      variant="outline"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No pending invitations.
            </p>
          )}
        </CardContent>
      </Card>
      <Dialog onOpenChange={setIsRenameOpen} open={isRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription>
              Rename the currently active workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              onChange={(event) => setNewName(event.target.value)}
              value={newName}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setIsRenameOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={updateMutation.isPending || !newName.trim()}
              onClick={() => void rename()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InviteMemberDialog
        isOpen={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        seatsUsed={
          (workspace?.seats.used ?? 0) + (workspace?.invitations.length ?? 0)
        }
        totalSeats={workspace?.seats.total ?? 1}
      />
    </div>
  );
}
