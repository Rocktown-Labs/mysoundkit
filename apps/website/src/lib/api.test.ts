import { describe, expect, it, vi } from "vitest";

import { SoundKitApiError, rpcJson } from "./api";

vi.mock("@soundkit/env/web", () => ({
  env: { VITE_SERVER_URL: "https://api.soundkit.test" },
}));

describe("SoundKit API errors", () => {
  it("preserves typed server error codes for upload recovery", async () => {
    const response = Response.json(
      {
        code: "MASTER_UPLOAD_PENDING",
        message: "Master audio must finish uploading.",
      },
      { status: 400 }
    );

    await expect(rpcJson(response)).rejects.toEqual(
      expect.objectContaining({
        code: "MASTER_UPLOAD_PENDING",
        message: "Master audio must finish uploading.",
        status: 400,
      })
    );
  });

  it("uses the SoundKit API error class", () => {
    expect(new SoundKitApiError("Failure", 409, "CONFLICT")).toMatchObject({
      code: "CONFLICT",
      name: "SoundKitApiError",
      status: 409,
    });
  });
});
