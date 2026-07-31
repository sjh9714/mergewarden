# Start Here

One page: what to install, what you will see, and what each finding means.

## Install

Create `.github/workflows/mergewarden.yml`:

```yaml
name: MergeWarden
on:
  pull_request:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled, ready_for_review]
permissions:
  contents: read
  pull-requests: write
jobs:
  mergewarden:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/mergewarden@v0.9.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
          comment: auto
```

There is no config file to write and no checkout step. Until you add a
`mergewarden.yml`, the built-in default policy is used.

## What happens on the first pull request

Most agent pull requests cross no boundary. Those pass, and `comment: auto`
leaves them alone — the findings are written to the Actions job summary
instead. You get a comment when there is a warning, an error, or an analysis
the tool could not complete. Push a fix and that comment updates itself to
`PASSED` rather than being deleted, so a stale review request never outlives
the problem it described.

`mode: warn` and `fail-on-block: false` mean nothing is ever blocked from
merging. Run it that way for a week before deciding whether to tighten it.

## What each finding means

| Finding                            | What it is telling you                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `agent/origin-detected`            | This pull request looks agent-authored. Context, not a problem.                                                 |
| `contract/missing`                 | No declared scope in the PR body. Informational by default.                                                     |
| `contract/out-of-scope`            | A file changed outside the scope the PR itself declared.                                                        |
| `agent-control-plane/drift`        | `AGENTS.md`, `CLAUDE.md`, `.mcp.json` or similar changed. These steer every future agent run in the repository. |
| `workflow/permission-escalation`   | A workflow gained permissions it did not have on the base branch.                                               |
| `workflow/agentic-untrusted-input` | PR-controlled text now flows into an agent prompt.                                                              |
| `dependency/*`                     | An added or changed install-time lifecycle script.                                                              |
| `analysis/*`                       | The tool could not see everything it needed. Treat as inconclusive.                                             |

The first two are the ones you will see most, and neither of them changes the
decision. Only warnings and errors do.

## The two questions people ask next

**Will it be noisy?** On 46 merged human pull requests it said nothing on 44,
and both findings were correct — [the measurement](study/what-a-zero-config-install-reports.md).

**How do I make it stricter?** Raise `contract.missing_severity` to `warn` once
you have asked contributors to declare scope, then to `error` once they do, and
switch `mode` to `block` when you trust the result. Each step is one line in
[configuration](configuration.md).

If MergeWarden flags something your team decided was fine, please open an issue
with the scan output. That is the most useful bug report this project can get.

Running the agent yourself rather than reviewing its pull requests? The same
engine ships as an [MCP server](../packages/mcp/README.md) that checks a change
against the scope you gave it, before a pull request exists.

Next: [getting started](getting-started.md) · [configuration](configuration.md) ·
[Action reference](action-reference.md) · [security model](security-model.md)
