export const canManageWorkspace = (role?: string | null) =>
  role === "owner" || role === "admin";

export const hasWorkspaceCapacity = ({
  memberCount,
  pendingInvitationCount,
  totalSeats,
}: {
  memberCount: number;
  pendingInvitationCount: number;
  totalSeats: number;
}) => memberCount + pendingInvitationCount < totalSeats;
