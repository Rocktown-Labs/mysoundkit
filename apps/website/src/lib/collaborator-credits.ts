export const COLLABORATOR_CREDIT_ROLES = [
    "artist",
    "songwriter",
    "producer",
  ] as const,
  DEFAULT_COLLABORATOR_CREDIT_ROLE = "artist",
  isCollaboratorCreditRole = (value: string): value is CollaboratorCreditRole =>
    COLLABORATOR_CREDIT_ROLES.includes(value as CollaboratorCreditRole);

export type CollaboratorCreditRole = (typeof COLLABORATOR_CREDIT_ROLES)[number];
