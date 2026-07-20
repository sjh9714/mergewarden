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
  authors: []
  labels: [ai, agent]
  branch_patterns: ["codex/**", "ai/**"]
  body_patterns: []

contract:
  required_for: [agent]
  allow_missing_in_observe_mode: true
```

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
```

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
  paths: ["AGENTS.md", "**/AGENTS.md", ".mcp.json", ".codex/**"]
  severity: error

package_scripts:
  enabled: true
  paths: ["package.json", "**/package.json"]
  lifecycle_scripts: [preinstall, install, postinstall, prepare]
  severity: warn
```
