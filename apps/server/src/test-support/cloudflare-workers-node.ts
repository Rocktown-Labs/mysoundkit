const nodeEnv = process.env as Record<string, string | undefined>;

export const env = new Proxy(nodeEnv, {
  get: (target, prop: string) => target[prop],
}) as Record<string, unknown>;

export const workers = undefined;

export class WorkflowEntrypoint {
  public readonly ctx: unknown;
  public readonly env: unknown;

  public constructor(ctx?: unknown, workerEnv?: unknown) {
    this.ctx = ctx;
    this.env = workerEnv;
  }
}
