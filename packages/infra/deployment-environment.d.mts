export interface DeploymentEnvironment {
  analyticsEnvironment: string;
  databaseTargets: string[];
  isLocalDev: boolean;
  isProduction: boolean;
  isPullRequestPreview: boolean;
  kind: "local" | "preview" | "production" | "staging";
  scheduledJobsEnabled: boolean;
  stage: string;
}
export interface IsolationConfiguration {
  databaseTarget?: string;
  externalEffects?: string;
  hasEmailCredentials?: boolean;
  hasFulfillmentCredentials?: boolean;
  mediaBucket?: string;
  scheduledJobsEnabled?: boolean;
  stripeKey?: string;
}
export function deploymentEnvironment(
  stage: string,
  localDev?: boolean
): DeploymentEnvironment;
export function isolationMode(mode?: string): "report" | "enforce";
export function isolationFindings(
  environment: DeploymentEnvironment,
  configuration: IsolationConfiguration
): string[];
export function databaseIdentityFinding(
  environment: DeploymentEnvironment,
  declaredTarget: string | undefined,
  actualTarget: unknown
): string | null;
