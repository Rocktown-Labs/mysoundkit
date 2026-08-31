/* eslint-disable sort-vars */
import { Link } from "@tanstack/react-router";
import {
  Check,
  Clock,
  ExternalLink,
  FolderKanban,
  LoaderCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MessageSummary } from "@/lib/soundkit-api-hooks";

export type CollaborationResponseAction = "accept" | "cancel" | "decline";
type CollaborationAttachment = MessageSummary["attachments"][number];
type CollaborationProposal = CollaborationAttachment["collaboration"];

interface CollaborationMessageCardProps {
  attachment: CollaborationAttachment;
  isMine: boolean;
  isResponding?: boolean;
  onRespond: (targetId: string, action: CollaborationResponseAction) => void;
}

interface CollaborationActionsProps {
  isLocalPending: boolean;
  isMine: boolean;
  isPending: boolean;
  isResponding: boolean;
  onRespond: CollaborationMessageCardProps["onRespond"];
  targetId: string;
}

const statusLabel = (status: string | undefined) => {
  switch (status) {
    case "accepted": {
      return "Accepted";
    }
    case "expired": {
      return "Expired";
    }
    case "rejected": {
      return "Declined";
    }
    case "revoked": {
      return "Cancelled";
    }
    default: {
      return "Pending";
    }
  }
};

function CollaborationActions({
  isLocalPending,
  isMine,
  isPending,
  isResponding,
  onRespond,
  targetId,
}: CollaborationActionsProps) {
  if (isLocalPending) {
    return (
      <Button className="w-full" disabled size="sm" variant="secondary">
        <LoaderCircle className="mr-2 size-3.5 animate-spin" />
        Sending proposal…
      </Button>
    );
  }

  if (isMine && isPending) {
    return (
      <Button
        className="h-7 w-full text-xs text-muted-foreground hover:text-destructive"
        disabled={isResponding}
        onClick={() => onRespond(targetId, "cancel")}
        size="sm"
        variant="ghost"
      >
        Cancel invitation
      </Button>
    );
  }

  if (!isMine && isPending) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-8 gap-1 bg-primary text-xs"
          disabled={isResponding || !targetId}
          onClick={() => onRespond(targetId, "accept")}
          size="sm"
        >
          {isResponding ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Accept
        </Button>
        <Button
          className="h-8 text-xs"
          disabled={isResponding || !targetId}
          onClick={() => onRespond(targetId, "decline")}
          size="sm"
          variant="outline"
        >
          Decline
        </Button>
      </div>
    );
  }

  return null;
}

function CollaborationLink({ proposal }: { proposal: CollaborationProposal }) {
  if (!proposal || proposal.status !== "accepted") {
    return null;
  }

  if (proposal.kind === "project") {
    return (
      <Button asChild className="w-full gap-1.5" size="sm" variant="secondary">
        <Link params={{ id: proposal.targetId }} to="/dashboard/projects/$id">
          <ExternalLink className="size-3.5" />
          View project
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild className="w-full gap-1.5" size="sm" variant="secondary">
      <Link params={{ id: proposal.targetId }} to="/dashboard/tracks/$id">
        <ExternalLink className="size-3.5" />
        View track
      </Link>
    </Button>
  );
}

function proposalMessage(
  proposal: CollaborationProposal,
  isLocalPending: boolean,
  isPending: boolean
) {
  if (proposal?.expiresAt && isPending) {
    return `Accept by ${new Date(proposal.expiresAt).toLocaleString()}`;
  }

  if (isLocalPending) {
    return "Creating workspace…";
  }

  if (proposal?.status === "accepted") {
    return "Workspace unlocked";
  }

  return statusLabel(proposal?.status);
}

export function CollaborationMessageCard({
  attachment,
  isMine,
  isResponding = false,
  onRespond,
}: CollaborationMessageCardProps) {
  const proposal = attachment.collaboration,
    isAccepted = proposal?.status === "accepted",
    isLocalPending = attachment.id.startsWith("local-attachment-"),
    isPending = proposal?.status === "pending" || isLocalPending,
    targetId =
      proposal?.targetId ??
      attachment.sourceProjectId ??
      attachment.sourceTrackId ??
      "";

  return (
    <div className="w-full max-w-sm space-y-3 rounded-2xl border-2 border-primary/40 bg-card/95 p-4 shadow-xl">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2 font-bold text-primary text-sm">
          <FolderKanban className="size-4.5" />
          <span>Shared Collaboration</span>
        </div>
        <Badge variant={isAccepted ? "default" : "outline"}>
          {statusLabel(proposal?.status)}
        </Badge>
      </div>
      <div>
        <p className="font-bold text-base text-foreground">
          {attachment.displayName}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 text-amber-400" />
          {proposalMessage(proposal, isLocalPending, isPending)}
        </p>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <CollaborationActions
          isLocalPending={isLocalPending}
          isMine={isMine}
          isPending={isPending}
          isResponding={isResponding}
          onRespond={onRespond}
          targetId={targetId}
        />
        <CollaborationLink proposal={proposal} />
      </div>
    </div>
  );
}
