import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { assertCompleteReview } from "./code-review-result.mjs";

// Credentials come from OCR's local configuration or OCR_LLM_* environment.
// Pass ref/background/resume options directly through to the pinned CLI.
async function main() {
  const args = process.argv.slice(2),
    output =
      process.env.OCR_REPORT_PATH ??
      path.join(
        await mkdtemp(path.join(tmpdir(), "soundkit-ocr-")),
        "review.json"
      ),
    version = await promisify(execFile)("ocr", ["version"]);
  if (
    args.some((arg) =>
      /^--(?:output|format|audience)(?:=|$)|^-[ofa]/u.test(arg)
    )
  ) {
    throw new Error(
      "Output options are managed by this wrapper; use OCR_REPORT_PATH."
    );
  }
  if (!/^open-code-review v1\.13\.3(?:\s|$)/u.test(version.stdout)) {
    throw new Error(
      "Install Open Code Review v1.13.3 before running this script."
    );
  }

  await runReview(args, output);
  await validateReport(output);
}

async function validateReport(output) {
  const result = JSON.parse(await readFile(output, "utf-8"));
  assertCompleteReview(result);
  console.info(
    result.status === "skipped"
      ? `No supported files to review. Report saved to ${output}.`
      : `Review completed. Inspect findings in ${output}; completion is not approval.`
  );
}

async function runReview(args, output) {
  const child = spawn(
      "ocr",
      [
        "review",
        "--concurrency",
        "2",
        "--effort",
        "low",
        "--max-tokens-budget",
        "700000",
        "--timeout",
        "15",
        ...args,
        "--format",
        "json",
        "--audience",
        "human",
        "--output",
        output,
      ],
      { stdio: "inherit" }
    ),
    [code] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`Open Code Review exited with code ${code}.`);
  }
}
try {
  // This executable is not imported by applications.
  // eslint-disable-next-line node/no-top-level-await
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
