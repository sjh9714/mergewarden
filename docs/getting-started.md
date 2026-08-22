# Getting Started

Start with a public repository review queue. Use the detailed PR scan when a
row needs security boundary evidence. Install the Action only if that second
result is useful.

## Review a repository before opening code

Open the [public review queue](https://sjh9714.github.io/mergewarden/) and paste
`owner/repository` or a full GitHub repository URL.

The browser reads the latest thirty open PR summaries, skips trusted roles,
base repository branches, and known maintenance automation, then loads at most
ten external PRs. It shows four facts.

- Missing issue link
- Description under 80 prose characters
- Visible pull request template not followed
- More than 50 files or 1,500 changed lines

First contribution is context only. It does not add a note or affect ordering.
Facts that appear on nearly every row are lifted into one repository pattern so
they do not dominate the queue.

The queue reads public metadata and the base branch PR template. It never reads
changed file contents, runs code, stores data, or writes to GitHub.

Anonymous GitHub API limits apply. Use the authenticated CLI for a larger
queue.

```bash
GH_TOKEN=github_pat_... npx --yes mergewarden@0.10.4 triage owner/repository
```

## Understand queue states

| Outcome    | Meaning                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Rows       | External PRs were read and ordered by missing review context                                          |
| Empty      | The latest results contain no external PRs after trusted roles and maintenance automation are removed |
| Incomplete | One or more selected PRs could not be read, so visible rows are only a partial queue                  |
| Error      | The target, GitHub rate limit, or network request prevented the queue read                            |

An incomplete queue is never a clean result. Retry it or use the authenticated
CLI command shown by the page.

## Inspect one pull request

Paste a full PR URL or `owner/repository#number` into the same input. Queue rows
also link to this scan.

The detailed scan checks workflow permissions, coding-agent instructions,
untrusted prompt inputs, and install-time scripts. It shows warnings and errors
first and keeps informational findings out of the first result.

```bash
npx --yes mergewarden@0.10.4 scan https://github.com/owner/repository/pull/123
```

Set `GH_TOKEN` for private repositories or a higher rate limit. There is no
token flag because command-line flags can land in shell history and CI logs.
The [CLI reference](cli.md) covers JSON and Markdown output.

## Understand detailed scan states

| Outcome    | Meaning                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| Findings   | One or more deterministic checks found a boundary change for a person to review |
| Pass       | Analysis completed and found no high-signal boundary change                     |
| Incomplete | GitHub did not provide enough evidence for a deterministic result               |
| Error      | The PR target, GitHub rate limit, or network request prevented analysis         |

A pass is not a general code review. It covers only the configured workflow,
agent-control, prompt-input, and install-time checks.

## Install the detailed PR check

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

The Action automates the detailed boundary check. It does not order the review
queue. It has no checkout step and uses the GitHub job token. `comment: auto`
stays silent on a complete pass and updates one comment when attention is
needed.

Pull requests from forks receive a read-only token, so the Action cannot
comment on those PRs. Findings still appear in the job summary.

## Tune only after observing

The default policy runs in `warn` mode. Leave it there until you have reviewed
real findings from your repository.

Change individual severities before changing the whole policy mode. Consider
`mode: block`, `fail-on-block: true`, and a required branch protection check
only after the evidence is consistently useful.

## Verify the trust boundary

- Policy comes from the exact base commit.
- PR-controlled code is never checked out or executed.
- Workflow expressions are never evaluated.
- Analysis does not call a language model.
- Missing file evidence produces an incomplete result.

Read the [security model](security-model.md) before enabling blocking behavior.

## Advanced interfaces

The [MCP server](../packages/mcp/README.md) checks agent work before a PR exists.
It is separate from the public review queue and detailed PR scan.
