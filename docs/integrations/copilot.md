# Gating GitHub Copilot Coding Agent PRs

GitHub Copilot coding agent opens pull requests from `copilot/**` branches as
`copilot-swe-agent[bot]`. This page wires those PRs into MergeWarden so every
one is checked against your declared boundaries before merge.

## 1. Install the Action

Add `.github/workflows/mergewarden.yml` with the released Action pinned to its
full commit SHA:

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
      - uses: sjh9714/mergewarden@415122bf756157735b5b2e569c48a846064f5b17 # v0.10.2
        with:
          comment: auto
```

No checkout step is needed and the Action never executes PR code.

`comment: auto` posts a pull-request comment only when there is an error, a
warning, or an incomplete analysis. A routine agent pull request that crossed
no boundary gets nothing. It needs `pull-requests: write`; drop both if you
would rather read the findings in the Actions job summary.

## 2. Detect Copilot PRs

Add `mergewarden.yml` to your default branch:

```yaml
version: 1
mode: warn

agent_detection:
  authors: ["copilot-swe-agent[bot]"]
  labels: [ai, copilot]
  branch_patterns: ["copilot/**"]

contract:
  required_for: [agent]
```

Detection is a heuristic for deciding which PRs must carry a contract; it is
not proof of authorship. The author signal complements the branch and label
signals when a repository changes its branch naming convention.

## 3. Teach the Agent to Declare Scope

Add this to `.github/copilot-instructions.md` so the agent declares its
intended scope in every PR body:

```md
## Pull Requests

Every PR description must include a MergeWarden contract declaring the paths
this task should touch, for example:

<!-- mergewarden-contract
version: 1
agent: copilot
task: <one-line task summary>
allowed_paths:
  - src/feature/**
  - test/feature/**
-->
```

Repository-wide Copilot instructions are version-controlled and automatically
available to the coding agent. A pull request template can carry the same
comment when you want every contributor to see it. Edits outside
`allowed_paths` become `contract/out-of-scope` findings with deterministic
evidence. The contract is an untrusted declaration; the base-branch policy
stays authoritative.

## What You Get Without Tuning

Even before any of the policy above, the built-in default policy reports:

- `agent-control-plane/drift` when a PR edits
  `.github/copilot-instructions.md`, `AGENTS.md`, `.mcp.json`, or similar files
  that steer future agent runs, including the agent editing its own
  instructions.
- `workflow/permission-escalation` and related workflow findings when a PR
  raises GitHub Actions privileges.
- `dependency/lifecycle-script-added` when a PR adds `postinstall`-style
  scripts that would execute on `npm install`.

## Rollout

Follow [Adopt Safely](../../README.md#adopt-safely): start in `warn`, review
findings, add expiring waivers only after human review, then move to `block`
with branch protection.
