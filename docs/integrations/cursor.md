# Gating Cursor Background Agent PRs

Cursor background agents work on separate branches and commonly open pull
requests from `cursor/**` branches. This page wires those PRs into MergeWarden
so every one is checked against your declared boundaries before merge.

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
  pull-requests: read

jobs:
  mergewarden:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/mergewarden@21982fe53cec6d465777bc853de097da8f74708d # v0.4.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
```

No checkout step is needed and the Action never executes PR code.

## 2. Detect Cursor PRs

Add `mergewarden.yml` to your default branch:

```yaml
version: 1
mode: warn

agent_detection:
  labels: [ai, cursor]
  branch_patterns: ["cursor/**"]

contract:
  required_for: [agent]
  allow_missing_in_observe_mode: true
```

Detection is a heuristic for deciding which PRs must carry a contract; it is
not proof of authorship.

## 3. Teach the Agent to Declare Scope

Add `.cursor/rules/mergewarden.mdc` as an always-applied project rule so the
agent declares its intended scope in every PR body:

```md
---
description: Declare MergeWarden scope in pull request descriptions
alwaysApply: true
---

## Pull Requests

Every PR description must include a MergeWarden contract declaring the paths
this task should touch, for example:

<!-- mergewarden-contract
version: 1
agent: cursor
task: <one-line task summary>
allowed_paths:
  - src/feature/**
  - test/feature/**
-->
```

Cursor project rules live under `.cursor/rules/` and are version-controlled
with the repository. Edits outside `allowed_paths` become
`contract/out-of-scope` findings with deterministic evidence. The contract is
an untrusted declaration; the base-branch policy stays authoritative.

## What You Get Without Tuning

Even before any of the policy above, the built-in default policy reports:

- `agent-control-plane/drift` when a PR edits `.cursor/**`, `AGENTS.md`,
  `.mcp.json`, or similar files that steer future agent runs — including the
  agent editing its own instructions.
- `workflow/permission-escalation` and related workflow findings when a PR
  raises GitHub Actions privileges.
- `dependency/lifecycle-script-added` when a PR adds `postinstall`-style
  scripts that would execute on `npm install`.

## Rollout

Follow [Adopt Safely](../../README.md#adopt-safely): start in `warn`, review
findings, add expiring waivers only after human review, then move to `block`
with branch protection.
