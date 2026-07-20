# Gating Codex PRs

Codex opens pull requests from `codex/**` branches. This page wires those PRs
into MergeWarden so every one is checked against your declared boundaries
before merge.

This repository is itself built by Codex and gates its own agent PRs with the
checkout-free workflow in
[`.github/workflows/mergewarden.yml`](../../.github/workflows/mergewarden.yml).

## 1. Install the Action

Copy [`templates/mergewarden-observe.yml`](../../templates/mergewarden-observe.yml)
to `.github/workflows/mergewarden.yml`. No checkout step is needed and the
Action never executes PR code.

## 2. Detect Codex PRs

Add `mergewarden.yml` to your default branch:

```yaml
version: 1
mode: warn

agent_detection:
  labels: [ai, codex]
  branch_patterns: ["codex/**"]

contract:
  required_for: [agent]
  allow_missing_in_observe_mode: true
```

Detection is a heuristic for deciding which PRs must carry a contract; it is
not proof of authorship.

## 3. Teach the Agent to Declare Scope

Add this to your repository's `AGENTS.md` so the agent declares its intended
scope in every PR body:

```md
## Pull Requests

Every PR description must include a MergeWarden contract declaring the paths
this task should touch, for example:

<!-- mergewarden-contract
version: 1
agent: codex
task: <one-line task summary>
allowed_paths:
  - src/feature/**
  - test/feature/**
-->
```

Edits outside `allowed_paths` become `contract/out-of-scope` findings with
deterministic evidence. The contract is an untrusted declaration; the
base-branch policy stays authoritative.

## What You Get Without Tuning

Even before any of the policy above, the built-in default policy reports:

- `agent-control-plane/drift` when a PR edits `AGENTS.md`, `.codex/**`,
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
