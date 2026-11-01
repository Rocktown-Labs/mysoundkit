import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("standalone CLI enforces the release, validates reports and rejects managed flags", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "soundkit-ocr-test-")),
    executable = path.join(directory, "ocr"),
    run = promisify(execFile),
    wrapper = fileURLToPath(new URL("review-code.mjs", import.meta.url));
  try {
    await writeFile(
      executable,
      `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv[2] === 'version') {
  console.log(process.env.FAKE_OCR_VERSION);
} else {
  fs.writeFileSync(process.argv[process.argv.indexOf('--output')+1], JSON.stringify({
    status:'skipped', manifest:{terminal_state:'skipped',coverage:{selected:[],completed:[],failed:[]}}
  }));
}
`
    );
    await chmod(executable, 0o700);
    const env = {
        ...process.env,
        FAKE_OCR_VERSION: "open-code-review v1.13.3 (fixture)",
        OCR_REPORT_PATH: path.join(directory, "result.json"),
        PATH: `${directory}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      success = await run(
        process.execPath,
        [wrapper, "--from", "HEAD", "--to", "HEAD"],
        { env }
      );
    assert.match(success.stdout, /No supported files to review/u);
    await assert.rejects(
      run(process.execPath, [wrapper], {
        env: { ...env, FAKE_OCR_VERSION: "open-code-review v1.13.3-beta" },
      }),
      /Install Open Code Review v1\.13\.3/u
    );
    await assert.rejects(
      run(process.execPath, [wrapper, "-oignored.json"], { env }),
      /Output options are managed/u
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
