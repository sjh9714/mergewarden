# Agent Gate v0.1.0 Launch Draft

## Title

Agent Gate v0.1.0: No AI PR gets merged without proof.

## Short Pitch

Agent Gate is a deterministic CI firewall for AI-generated pull requests. It
flags or blocks out-of-contract edits, workflow permission escalation, agent
control-plane drift, missing test evidence, and MCP config drift before those
changes reach `main`, depending on your policy mode.

`v0.1.0` is a GitHub prerelease. The core analyzer, replay CLI, root GitHub
Action, PR report comments, self-dogfooding workflow, and CI are implemented,
but APIs and rule names may still change in later releases.

## Why I Built It

AI coding agents can now open pull requests quickly. That is useful, but normal
tests do not always catch security and scope failures:

- an agent edits files outside the task it was assigned
- a workflow gains broader write permissions
- `AGENTS.md`, `.mcp.json`, or other agent-control files drift
- a high-risk source change lands without matching test-file evidence

Agent Gate adds a deterministic check between "the PR exists" and "the PR gets
merged."

## What It Catches

- Out-of-contract edits: changed files outside the PR body's declared
  `allowed_paths`.
- Workflow permission escalation: GitHub Actions workflows gaining broader
  workflow-level permissions.
- Dangerous workflow patterns: `write-all`, `id-token: write`,
  `pull_request_target` checkout of PR head, unpinned third-party actions, and
  added `secrets.*` usage.
- Agent control-plane drift: changes to files that can alter future agent
  behavior.
- Missing test evidence: high-risk source changes without matching test-file
  changes.
- MCP config drift: `.mcp.json` changes that can alter which tools an agent can
  call.

## Demo

Run a deterministic unsafe PR fixture locally:

```bash
pnpm --filter agent-gate build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation
```

Expected headline:

```text
Agent Gate: BLOCKED
ERROR workflow/permission-escalation
ERROR workflow/dangerous-pattern
Path: .github/workflows/release.yml
```

## Install

Add the root Action to a pull request workflow:

```yaml
permissions:
  contents: read
  pull-requests: read

jobs:
  agent-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/Agent-Gate@v0.1.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
```

Start with `mode: warn` and `fail-on-block: false`. After policy findings are
tuned, move toward `mode: block` and `fail-on-block: true`.

## Security Model

Runtime analysis does not call LLMs or execute PR code. The GitHub Action does
not checkout the pull request, does not run repository scripts, and does not
load policy from the untrusted PR head. It reads pull request metadata and file
contents through GitHub APIs, loads `agent-gate.yml` from the base ref, and runs
the deterministic core analyzer.

## Known Limitations

- `v0.1.0` is pre-release; APIs, rule names, reports, and configuration may
  change.
- Test evidence is file-pattern based. It does not prove semantic test coverage.
- CODEOWNERS and reviewer evidence are not implemented yet.
- Package and dependency drift rules are not implemented yet.
- GitHub Actions job-level permission escalation comparison is limited.
- PR comment upsert requires `issues: write` and can warn on fork PRs with
  read-only tokens.

## Feedback Wanted

I am especially interested in feedback from teams trying AI-generated PRs in
real repositories:

- Which findings are useful enough to block?
- Which findings should stay warning-only?
- What high-risk path patterns do you use?
- Which missing rules would make Agent Gate more practical for your workflow?
