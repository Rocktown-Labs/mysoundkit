export interface AuthenticatedSession {
  activeOrganizationId?: string | null;
  id: string;
  userId: string;
}

export interface AuthenticatedUser {
  email?: string | null;
  id: string;
  name?: string | null;
}

export interface AppVariables {
  requestId: string;
  session: AuthenticatedSession | null;
  user: AuthenticatedUser | null;
}

export interface AppEnv {
  Variables: AppVariables;
}
