export interface AppVariables {
  session: unknown | null;
  user: unknown | null;
}

export interface AppEnv {
  Variables: AppVariables;
}
