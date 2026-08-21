# CLI Reference

The public CLI analyzes GitHub pull requests without cloning or executing the
target repository.

## Commands

```text
mergewarden demo
mergewarden scan OWNER/REPO#NUMBER
mergewarden scan https://github.com/OWNER/REPO/pull/NUMBER
mergewarden replay FIXTURE_DIR
mergewarden --help
mergewarden --version
```

Run without installing:

```bash
npx --yes mergewarden@0.10.3 scan owner/repository#123
```

## Demo

`mergewarden demo` analyzes an example pull request that ships inside the CLI.
It makes no network calls, needs no token, and uses the **default** policy, so
its output is a statement about what a zero-configuration install actually
reports. It accepts `--format human|json|markdown`.

The example is a documentation pull request that quietly adds one instruction
to `CLAUDE.md`. The default policy reports one `agent-control-plane/drift`
finding, which keeps the first run focused on the change MergeWarden leads with.

## Scan Options

| Option     | Values                      | Default           |
| ---------- | --------------------------- | ----------------- |
| `--format` | `human`, `json`, `markdown` | `human`           |
| `--config` | Base-branch repository path | `mergewarden.yml` |
| `--mode`   | `observe`, `warn`, `block`  | Config value      |

Config paths must be relative repository paths without `..`. The CLI always
loads them from the exact base SHA, never from the PR head.

## Authentication

Token precedence is:

1. `GH_TOKEN`
2. `GITHUB_TOKEN`
3. unauthenticated GitHub API for public repositories

There is no token flag because command-line arguments are commonly retained in
shell history and process listings. Tokens are never printed.

### Token scopes

Nothing the CLI does requires write access of any kind.

- **Public repositories.** `scan` needs no token at all. `triage` does need one,
  but only for the rate limit: it makes one request per pull request, and GitHub
  allows 60 unauthenticated requests an hour, which one queue uses up. A
  fine-grained token with **no scopes selected** is enough, since public data
  needs none.
- **Private repositories.** Either a classic token with the `repo` scope, or a
  fine-grained token with read-only **Contents** and **Pull requests** on the
  target repository. Metadata access comes with those automatically.

When in doubt, create the smallest token and try it: the CLI fails with the
API's error rather than guessing around a missing permission.

## Output and Exit Codes

Reports go to stdout. Diagnostics and actionable API errors go to stderr.

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| `0`  | Complete pass or warning decision                  |
| `1`  | Complete block decision                            |
| `2`  | Usage, API, config, or incomplete-analysis failure |

Human output shows at most ten findings and reports the omitted count. JSON and
Markdown retain all available findings within the 250-finding/2 MB report
boundary and preserve any further omitted count.

## API Reliability

Each GitHub request has a 30-second timeout. MergeWarden makes at most three
attempts for network failures, HTTP 502/503/504, and confirmed rate limits,
while bounding additional retry waits to 60 seconds. `Retry-After` and GitHub's
reset time are honored; ordinary permission-denied 403 responses are not
retried. Diagnostics retain status and request ID without printing the token.
See GitHub's
[rate-limit documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Safety

The CLI uses GitHub APIs only. It does not clone, checkout, install, spawn
repository commands, or execute PR-controlled code. Node.js 20 or newer is
required.
