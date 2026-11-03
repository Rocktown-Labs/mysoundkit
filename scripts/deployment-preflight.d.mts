export function deploymentPreflight(options: {
  stage: string;
  mode?: string;
  env?: Record<string, string | undefined>;
  checkDatabase?: boolean;
  readIdentity?: (url: string | undefined) => Promise<unknown>;
}): Promise<{
  enforced: boolean;
  findings: string[];
  kind: string;
  passed: boolean;
  stage: string;
}>;
