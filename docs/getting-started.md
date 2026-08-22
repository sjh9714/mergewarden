# Getting Started

Start with one public pull request. Install the Action only after the result is
useful to you.

## Scan before installing

Open the [public PR scanner](https://sjh9714.github.io/mergewarden/) and paste a
full GitHub PR URL or `owner/repository#number`.

The browser reads the public GitHub API directly. It needs no login or token,
stores nothing, and does not execute code. Anonymous GitHub API limits still
apply.

The result shows at most three high-signal findings first. It hides
informational findings and folds any additional warnings or errors. Each visible
finding gives you the title, file, reason, and first recommended check.

## Understand the result

MergeWarden separates four outcomes.

| Outcome    | Meaning                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| Findings   | One or more deterministic checks found a boundary change for a person to review |
| Pass       | Analysis completed and found no high-signal boundary change                     |
| Incomplete | GitHub did not provide enough evidence for a deterministic result               |
| Error      | The PR target, GitHub rate limit, or network request prevented analysis         |

A pass is not a general code review. It means only that the configured workflow,
agent-control, prompt-input, and install-time checks found nothing actionable.

Never treat an incomplete result as a pass. Retry it or use the authenticated
CLI command shown by the scanner.

## Scan from the terminal

The CLI follows the same parser, collector, rules, finding IDs, and policy
digest as the web scanner.

```bash
npx --yes mergewarden@0.10.4 scan https://github.com/owner/repository/pull/123
```

Set `GH_TOKEN` for private repositories or a higher rate limit.

```bash
GH_TOKEN=github_pat_... npx --yes mergewarden@0.10.4 scan owner/repository#123
```

There is no token flag because command-line flags can land in shell history and
CI logs. The [CLI reference](cli.md) covers JSON and Markdown output.

## Install the Action

Create `.github/workflows/mergewarden.yml`.

```yaml
name: MergeWarden PR Risk Check

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  mergewarden:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/mergewarden@v0.10.4
        with:
          comment: auto
```

There is no checkout step, config file, or token to create. The Action uses the
GitHub job token and built-in policy. `comment: auto` stays silent on a complete
pass and writes one updateable comment when a warning, error, or incomplete
analysis needs attention.

Pull requests from forks receive a read-only token, so the Action cannot comment
on those PRs. The findings still appear in the job summary.

## Tune only after observing

The default policy runs in `warn` mode. Leave it there until you have reviewed
real findings from your repository.

When the evidence is consistently useful, change individual severities before
changing the whole policy mode. Then consider `mode: block`,
`fail-on-block: true`, and a required branch-protection check.

Use a narrow expiring waiver for evidence a maintainer has accepted. Do not
disable an entire rule family to hide one reviewed finding. The
[configuration reference](configuration.md) has exact syntax.

## Verify the trust boundary

- Policy comes from the exact base commit.
- PR-controlled code is never checked out or executed.
- Workflow expressions are never evaluated.
- Analysis does not call a language model.
- Missing file evidence produces an incomplete result.

Read the [security model](security-model.md) before enabling blocking behavior.

## Advanced interfaces

The first path needs only the web scanner, CLI, and Action. The existing
[`triage`](triage.md) queue reader and [MCP server](../packages/mcp/README.md)
remain available for teams that need those separate workflows.
