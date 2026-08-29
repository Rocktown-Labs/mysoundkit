import { describe, expect, it } from "vitest";

import { projectCoverFile } from "./project-cover";

describe("projectCoverFile", () => {
  it("uses a project-safe cover filename while preserving the extension", () => {
    const file = projectCoverFile(
      new File(["cover"], "original.PNG", { type: "image/png" }),
      "Made In Arkansas Vol. 1"
    );

    expect(file.name).toBe("made-in-arkansas-vol-1-cover.png");
  });

  it("uses the mime type when the source file has no extension", () => {
    const file = projectCoverFile(
      new File(["cover"], "artwork", { type: "image/jpeg" }),
      "Untitled Project"
    );

    expect(file.name).toBe("untitled-project-cover.jpg");
  });
});
