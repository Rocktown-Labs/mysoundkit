# Kimi code reviews

We use [Alibaba Open Code Review](https://github.com/alibaba/open-code-review)
v1.13.3 with Cloudflare Workers AI's `@cf/moonshotai/kimi-k2.7-code` model.
Reviews supplement Pullfrog, tests, and human review. They do not merge PRs or
constitute a security sign-off. Verify findings against requirements before fixing.

## Standalone

Install the v1.13.3 CLI from the upstream release and configure a custom provider
named `cloudflare` using `ocr config provider` (see `ocr config provider --help`
for the interactive setup). Keep credentials
in the local OCR configuration, never in repository files or command arguments.

```sh
git fetch origin master
OCR_REPORT_PATH=/tmp/soundkit-review.json node scripts/review-code.mjs \
  --from origin/master --to HEAD --provider cloudflare \
  --model '@cf/moonshotai/kimi-k2.7-code' \
  --background 'Describe the requirements and intentional behavior here'
```

The wrapper pins the CLI version, defaults to two concurrent tasks, low effort,
a 700,000 token budget and a 15 minute per-task timeout, and exits nonzero for
partial coverage. OCR checks the budget between model rounds, so active tasks
can overshoot the token target. Additional CLI flags can override the usage defaults. Reports
contain source context; save them outside the repository. OCR can exclude tests
and documentation, so its completion only covers the selected source files.
The report's manifest records exact commits and selected/completed coverage.
For an environment-only setup, use the supported `OCR_LLM_*` variables and omit
`--provider cloudflare` from the command; that flag requires a saved provider.

Resume a partial run with the same refs and `--resume <session_id>`; inspect the
new report rather than treating the first CLI exit code as success.

## GitHub Actions

`Kimi Code Review` runs on open, ready, same-repository PRs targeting master.
After this workflow reaches master, it can also be dispatched with a PR number:

```sh
gh workflow run open-code-review.yml -f pr_number=123
```

Repository configuration:

- Secret `OPEN_CODE_REVIEW_API_KEY`: dedicated Cloudflare Workers AI credential.
- Variable `OPEN_CODE_REVIEW_LLM_URL`: the account's OpenAI-compatible AI endpoint.
- Variable `OPEN_CODE_REVIEW_LLM_MODEL`: `@cf/moonshotai/kimi-k2.7-code`.

The upstream action and CLI are pinned. It checks out the repository, reads
the PR comparison through git objects, publishes inline comments and a summary,
and uploads review artifacts. Fork PRs do not receive credentials. Jobs have bounded runtime
and token usage; stale runs cancel when a newer commit arrives. Partial reviews
or failed publication fail the completion gate. Docs-only changes and repeated
reviews of an already-reviewed head pass as no-work outcomes. Findings still require triage;
a successful job means the selected range was reviewed and published, not that
the code is approved. Existing checks remain responsible for types and tests.

Run the standalone completion checks with:
`node --test scripts/code-review-*.test.mjs`.

When upgrading OCR, update the workflow pin, CLI version and defaults in both
the workflow and standalone wrapper together, then run both paths again. The
workflow uses the upstream publisher; standalone use saves a local report.
