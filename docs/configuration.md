# Configuration Reference

MergeWarden reads `mergewarden.yml` from the exact PR base SHA. A PR cannot weaken
its own policy by modifying its head copy.

## Top-Level Policy

```yaml
version: 1
mode: warn
```

`mode` is `observe`, `warn`, or `block`.

## Agent Detection and Contracts

```yaml
agent_detection:
  # 11 coding-agent bot accounts by default — Copilot, Jules, Devin, Kiro,
  # Codegen, OpenCode, Tembo, Amazon Q, Mentat, Factory Droid, Ellipsis.
  authors: ["copilot-swe-agent[bot]", "google-labs-jules[bot]", "..."]
  labels: [] # label conventions are per-repository; add your own
  branch_patterns: ["codex/**", "claude/**", "cursor/**", "copilot/**", "devin/**"]
  body_patterns: ["Generated with [Claude Code]"]

contract:
  required_for: [agent]
  allow_missing_in_observe_mode: true
  missing_severity: warn
```

Those are the **defaults**, not a suggestion — they are the cohort definitions from the
[2,204-PR study](study/methodology.md), so a zero-config install recognises an agent pull
request out of the box. Setting any of these keys replaces the default list for that key
rather than adding to it. Detection is a heuristic for deciding which pull requests must
carry a contract; it is not proof of authorship.

PR contracts are comment blocks in the PR body:

```md
<!-- mergewarden-contract
version: 1
agent: codex
task: update authentication
allowed_paths:
  - src/auth/**
blocked_paths:
  - .github/workflows/**
-->
```

The contract is an untrusted declaration. `required_evidence` was removed in
v0.3.0 because it had no enforceable deterministic semantics.

`missing_severity` applies to `contract/missing` only. It defaults to `warn`
because that rule fires on the _absence_ of a convention rather than on
something a pull request did, and the [scan study](study/methodology.md) found
0 of 2,204 merged agent pull requests declaring a scope — so an `error` default
would make `mode: block` reject essentially every agent pull request the day it
is switched on. Set it to `error` once your contributors do declare scope.

`contract/invalid`, `contract/out-of-scope` and `contract/blocked-path` stay
`error` regardless: each fires on something the pull request did against its
own declaration.

## High-Risk Paths

```yaml
high_risk_paths:
  auth:
    paths: ["src/auth/**"]
    require_tests: ["test/auth/**"]
    severity: error
```

Matching test paths are change evidence, not proof of semantic coverage.

## GitHub Actions

```yaml
github_actions:
  paths: [".github/workflows/*.yml", ".github/workflows/*.yaml"]
  checks:
    permission_escalation: error
    write_all: error
    id_token_write: warn
    pull_request_target_head: error
    unpinned_action: warn
    unpinned_reusable_workflow: warn
    unpinned_container: warn
    missing_permissions: warn
    unknown_write_permission: warn
    added_secret_reference: warn
    workflow_deleted: warn
    malformed_workflow: error
    trigger_removed: warn
```

`trigger_removed` fires when a workflow stops firing on an event it used to —
the case GitHub's review guidance calls out as "confirm workflow still runs on
forks and pull requests". It defaults to `warn` because consolidating workflows
is ordinary and the artifact cannot tell that apart from a pull request removing
the check that would have gated it. See
[GitHub's review guidance mapped to rules](github-review-guidance.md).

Every check accepts `off`, `warn`, or `error`. Legacy
`block_permission_escalation`, `block_pull_request_target_checkout`,
`require_pinned_actions`, and shared `severity` remain accepted when `checks`
is absent. Mixing the two forms is rejected instead of applying hidden
precedence.

Remote actions and reusable workflows are pinned only by a full 40-character
commit SHA. Container images are pinned by `@sha256:` digest. Local actions and
workflows are excluded.

## Agentic Workflows

```yaml
agentic_workflows:
  enabled: true
  severity: warn
  privileged_severity: error
  additional_actions:
    - uses: owner/custom-agent-action
      prompt_inputs: [prompt]
```

The built-in registry recognizes Codex, Claude Code, and Gemini CLI Actions.
The v0.3.0 rule follows direct prompt expressions and one `env` hop only. It is
not a general cross-step taint analyzer.

## Exact, Expiring Waivers

```yaml
waivers:
  - finding_id: agf_0123456789abcdef
    reason: Approved OIDC release workflow
    expires_at: "2026-09-30T00:00:00Z"
```

- Waivers match one canonical finding ID.
- Duplicate IDs and invalid timestamps are config errors.
- The waiver is active only before `expires_at`.
- Waived findings remain in reports but do not affect the decision.
- Expired entries emit `policy/waiver-expired`.
- `analysis/*` findings cannot be waived.

## Other Rule Families

```yaml
agent_control_plane:
  # Defaults cover AGENTS.md, CLAUDE.md, GEMINI.md, QWEN.md (and **/ variants),
  # .cursor/**, .gemini/**, .codex/**, .github/copilot-instructions.md, .mcp.json,
  # and claude_desktop_config.json.
  paths: ["AGENTS.md", "**/AGENTS.md", "GEMINI.md", ".mcp.json", ".codex/**"]
  severity: error

package_scripts:
  enabled: true
  paths: ["package.json", "**/package.json"]
  lifecycle_scripts: [preinstall, install, postinstall, prepare]
  severity: warn
```

## Commit Trailers

Enforces the trailer conventions real AI-contribution policies are written in —
required disclosure trailers, or forbidden ones. Both lists are empty by
default, so this changes nothing until you add an entry.

```yaml
commit_trailers:
  enabled: true
  required:
    - any_of: [Assisted-by, Generated-by]
      applies_to: agent # agent | all
      severity: warn
  forbidden:
    - name: Co-authored-by
      value_patterns: ["*claude*", "*copilot*"]
      severity: error
```

A `required` entry is satisfied by **any** of its `any_of` trailers.
`applies_to: agent` evaluates it only when agent detection fires;
`applies_to: all` evaluates it on every pull request, which is what a DCO
`Signed-off-by:` requirement needs. A `forbidden` entry without
`value_patterns` rejects the trailer outright; with them, only matching values
are rejected.

These rules stay inert when MergeWarden could not enumerate every commit — see
[the commit trailer rule guide](rules/commit-trailers.md) for the limits and
how trailers are parsed.
