/* eslint-disable one-var */
import type { WorkflowStep } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectExportWorkflow } from "./project-export";

const { authorize, render, register, snapshot } = vi.hoisted(() => ({
  authorize: vi.fn(),
  register: vi.fn(),
  render: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("@/lib/project-export-access", () => ({
  isProjectExportSourceAuthorized: authorize,
}));
vi.mock("@/lib/project-export", () => ({
  createProjectExportSnapshot: snapshot,
  findReusableProjectExport: vi.fn().mockResolvedValue(null),
  markProjectExportProcessing: vi.fn(),
  registerProjectExport: register,
}));
vi.mock("@/lib/media-processing-jobs", () => ({
  updateMediaProcessingJob: vi.fn(),
}));
vi.mock("@/lib/media-processor", () => ({
  ContainerMediaProcessor: class {
    public createDerivative = render;
  },
}));
vi.mock("@/middleware/structured-logging", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

const cachedSnapshot = {
  exportVersion: 1,
  ownerUserId: "owner",
  projectId: "project",
  tracks: [
    {
      metadata: {},
      position: 1,
      sourceAssetId: "source",
      sourceObjectKey: "tracks/foreign/audio.m4a",
      targetObjectKey: "projects/project/export.m4a",
    },
  ],
};

describe("cached project export snapshots", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([false, true])(
    "rechecks authority inside rendering after restoring a cached snapshot (allowed=%s)",
    async (allowed) => {
      authorize.mockResolvedValue(allowed);
      render.mockResolvedValue({ objectKey: "projects/project/export.m4a" });
      const doStep = vi.fn(async (name: string, ...args: unknown[]) => {
          if (name === "snapshot project release context") {
            return cachedSnapshot;
          }
          const action = args.at(-1);
          if (typeof action !== "function") {
            throw new TypeError("Missing step callback");
          }
          return await action();
        }),
        workflow = new ProjectExportWorkflow(
          {} as ExecutionContext,
          { MEDIA_BUCKET: {}, MEDIA_PROCESSOR: {} } as Env
        ),
        workflowRun = workflow.run(
          {
            instanceId: "project_project_v1",
            payload: {
              exportVersion: 1,
              pipelineVersion: 1,
              projectId: "project",
            },
            timestamp: new Date(),
            workflowName: "project-export",
          },
          {
            do: doStep,
            sleep: vi.fn(),
            sleepUntil: vi.fn(),
            waitForEvent: vi.fn(),
          } as WorkflowStep
        );

      if (allowed) {
        await expect(workflowRun).resolves.toMatchObject({ status: "ready" });
        expect(render).toHaveBeenCalledTimes(1);
        expect(register).toHaveBeenCalledTimes(1);
      } else {
        await expect(workflowRun).rejects.toThrow("no longer authorized");
        expect(render).not.toHaveBeenCalled();
        expect(register).not.toHaveBeenCalled();
      }
      expect(snapshot).not.toHaveBeenCalled();
      expect(authorize).toHaveBeenCalledWith({
        projectId: "project",
        sourceAssetId: "source",
        sourceObjectKey: "tracks/foreign/audio.m4a",
      });
    }
  );
});
