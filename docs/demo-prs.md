# Demo PRs

This page collects concrete MergeWarden examples. Live sandbox pull requests are
separate from local replay fixtures and are not external adopter claims.

## Dogfooding: MergeWarden gates its own PRs

MergeWarden runs on every pull request to this repository. The self-gate is a
[base policy](../mergewarden.yml) plus a
[checkout-free workflow](../.github/workflows/mergewarden.yml) that pins the
Action — the same 30-second setup this project recommends to everyone else. The
`MergeWarden` badge at the top of the README is that check's live status.

This is not a sandbox: it gates real contributions, including ones from outside
maintainers and coding agents. For example,
[PR #120](https://github.com/sjh9714/mergewarden/pull/120) — an external
contributor's PR on a `codex/**` agent branch — was detected as an agent PR and
passed the [MergeWarden check](https://github.com/sjh9714/mergewarden/actions/runs/30059170947/job/89457928415)
because it declared a `mergewarden-contract` and stayed inside its declared
scope. That is the happy path the tool is built to make cheap.

If you adopt MergeWarden and it catches a real boundary crossing in your
repository, we would genuinely like to hear about it in an issue.

Proofs recorded before v0.4.0 ran under the project's former name, Agent Gate.
Their linked runs, screenshots, and `sjh9714/Agent-Gate` Action refs keep the
historical name; the old repository URL redirects to `sjh9714/mergewarden`.

## v0.6.0 Public Composite Proof

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/17
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/30169314930
- Action ref: `sjh9714/mergewarden@ec38a1dd467d04fa69a983a3b54ae6fb70f5aba6`
- Checkout step: not used
- Final decision: `warn`
- Findings: 9 error, 2 warning, 1 info
- Policy digest: `35e83a38996c79b52b8e7cd08ad6126ba5a35d8dbf65b3a76a1875c8d9fb7adc`

Unchanged from v0.5.1, and here the reason is specific: this pull request
**declares a contract**, so `contract/missing` — the rule v0.6.0 softened — never
fires on it. The finding driving the decision is `contract/out-of-scope`, which
stays `error` by design. A proof that a rule changed would need a pull request
without a contract; that evidence is the two real agent pull requests in the
[release notes](release-notes-v0.6.0.md).

## v0.5.1 Public Composite Proof

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/17
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/30162555920
- Action ref: `sjh9714/mergewarden@3f87f5d1197e24482aa3f0a788e0158e41d53baa`
- Checkout step: not used
- Base-branch policy: repository `mergewarden.yml`
- Final decision: `warn`
- Status: `needs-review`
- Findings: 9 error, 2 warning, 1 info
- Policy digest: `35e83a38996c79b52b8e7cd08ad6126ba5a35d8dbf65b3a76a1875c8d9fb7adc`

Identical to the v0.5.0 run below, including the policy digest — this sandbox
sets `agent_detection` explicitly, so neither v0.5.0's new defaults nor v0.5.1's
corrected body marker changes anything here. The evidence for the v0.5.1 fix is
the 13-pull-request Claude Code sample in the
[release notes](release-notes-v0.5.1.md), not this proof.

## v0.5.0 Public Composite Proof

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/17
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/30160399530
- Action ref: `sjh9714/mergewarden@d4892fa234498032a1e1bea6ff3882e76506722b`
- Checkout step: not used
- Base-branch policy: repository `mergewarden.yml`
- Final decision: `warn`
- Status: `needs-review`
- Findings: 9 error, 2 warning, 1 info
- Policy digest: `35e83a38996c79b52b8e7cd08ad6126ba5a35d8dbf65b3a76a1875c8d9fb7adc`

The same pull request re-run against the v0.5.0 release commit. Decision and
finding counts are identical to the v0.4.1 run below, which is worth stating
plainly: v0.5.0's headline change is that agent detection works without
configuration, and this sandbox already configured `agent_detection` explicitly,
so the new defaults have nothing to add here. The evidence that the defaults
changed anything is in the release notes' 14-repository measurement, not in this
proof. The policy digest differs because the default control-plane path list
gained `GEMINI.md` and `QWEN.md`; finding IDs did not change.

## v0.4.1 Public Composite Proof

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/17
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/30156230619
- Action ref: `sjh9714/mergewarden@ccef99499b5932864decf24656dc6b4aefd2e6a8`
- Checkout step: not used
- Base-branch policy: repository `mergewarden.yml`
- Final decision: `warn`
- Status: `needs-review`
- Findings: 9 error, 2 warning, 1 info
- Managed PR comment: posted by the run, with the detailed findings behind a
  `<details>` fold added in v0.4.1

The same pull request re-run against the v0.4.1 release commit. Rule outcomes
are identical to the v0.4.0 run below — same decision, same finding counts —
which is the point: the v0.4.1 changes are a new opt-in rule family and a
report-surface change, not a change in what the engine decides. The policy
digest differs because the configuration schema gained the `commit_trailers`
key; finding IDs did not change.

## v0.4.0 Public Composite Proof

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/17
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/29817195616
- Action ref: `sjh9714/mergewarden@21982fe53cec6d465777bc853de097da8f74708d`
- Checkout step: not used
- Base-branch policy: repository `mergewarden.yml`
- Declared scope: `src/auth/**`, `tests/auth/**`
- Final decision: `warn`
- Status: `needs-review`
- Findings: 9 error, 2 warning, 1 info
- Findings: two `contract/out-of-scope` findings
- Finding: `agent-control-plane/drift` for `AGENTS.md`
- Findings: three `workflow/permission-escalation` findings covering workflow
  scope, job scope, and job-scope `id-token`
- Findings: two `risk/high-risk-path` findings and two
  `workflow/dangerous-pattern` warnings
- Finding: `evidence/missing-test-change` for `src/auth/**` without matching
  `tests/auth/**` changes
- Managed PR comment: posted by the run via `comment: true`

The PR intentionally combines an in-contract auth change with a workflow
permission increase, an unpinned action, and agent instruction drift. The
public Action run downloads the exact v0.4.0 release commit, performs no
checkout, loads `mergewarden.yml` from the base branch, and records stable
finding IDs for every boundary crossing. The README GIF and report PNG are
rendered from real executions of the published `mergewarden@0.4.0` package
against this PR.

## v0.3.1 Public Composite Proof

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/16
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/29071622785
- Action ref: `sjh9714/Agent-Gate@5fc4a3a5087620ff23c6cb5b0351c3969339fc01`
- Checkout step: not used
- Base-branch policy: repository `agent-gate.yml`
- Declared scope: `docs/**`
- Final decision: `warn`
- Status: `needs-review`
- Findings: two `contract/out-of-scope` findings
- Finding: `risk/high-risk-path` for `.github/workflows/demo-release.yml`
- Finding: `agent-control-plane/drift` for `AGENTS.md`
- Findings: workflow- and job-scope `workflow/permission-escalation`

The PR intentionally combines an allowed documentation change with a workflow
permission increase and agent instruction drift. The successful public Action
run downloads the exact v0.3.1 release commit, performs no checkout, and records
stable finding IDs for every boundary crossing.

## Local Composite Boundary Fixture

Replay the v0.3.0 composite fixture to see a docs-only contract alongside
workflow privilege, agent-control-plane, MCP, and package lifecycle changes:

```bash
pnpm --filter mergewarden build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/composite-agent-boundary
```

This is reproducible fixture evidence, not an external adopter claim. The live
v0.3.1 proof above provides the corresponding public SHA-pinned Action run.

## First-Run Default Policy

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/11
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/28232902050
- Smoke record: `docs/history/smoke/external-install-smoke-v0.2.5.md`
- Action ref: `sjh9714/Agent-Gate@v0.2.5`
- Checkout step: not used
- Base-branch `agent-gate.yml`: absent
- Policy source: built-in default
- Report metadata: `configSource: default`
- Final decision: `warn`
- Finding: `dependency/lifecycle-script-added` for `package.json`

This PR verifies the README first-run shape: install the tag-pinned workflow,
open a pull request, and get warning-mode evidence without checking out PR code
or adding `agent-gate.yml` first.

## Workflow Permission Escalation

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/14
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/28440045859
- Smoke record: `docs/history/smoke/external-install-smoke-v0.2.6.md`
- Action ref: `sjh9714/Agent-Gate@v0.2.6`
- Checkout step: not used
- Base-branch `agent-gate.yml`: absent
- Policy source: built-in default
- Report metadata: `configSource: default`
- Final decision: `warn`
- Finding: `workflow/permission-escalation` for `.github/workflows/demo-release.yml`
- Demo change: workflow-level `permissions.contents` changed from `read` to
  `write`
- Demo change: job-level restrictive `permissions.contents: read` was removed
  from job `publish`, exposing the broader workflow-level permission
- Observed evidence: `permission_scope: workflow`
- Observed evidence: `permission_scope: job`
- Observed evidence: `job: publish`
- Observed evidence: `affected_capability: repository_content_writes`

This PR verifies that the built-in default policy can surface workflow
permission escalation evidence with workflow/job scope context, without checking
out PR code or adding `agent-gate.yml` first. It intentionally avoids
`pull_request_target` so the live demo stays focused on permission escalation.

Related local replay fixture:

```text
fixtures/unsafe-pr-zoo/workflow-permission-escalation
```

Replay:

```bash
pnpm --filter mergewarden build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation
```

The fixture demonstrates deterministic workflow evidence such as
`workflow/permission-escalation` and `workflow/dangerous-pattern`.

## Opt-In PR Comment Proof

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/13
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/28343307688
- Managed comment: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/13#issuecomment-4828248162
- Action ref: `sjh9714/Agent-Gate@v0.2.5`
- Checkout step: not used
- Base-branch `agent-gate.yml`: absent
- Policy source: built-in default
- Report metadata: `configSource: default`
- Final decision: `warn`
- Finding: `workflow/permission-escalation` for `.github/workflows/demo-release.yml`
- Demo change: `permissions.contents` changed from `read` to `write`

This PR verifies the optional PR comment surface. The default 30-second install
stays read-only and does not create comments. The comment demo opts into
`comment: true` and grants write-scoped PR/comment permissions in the sandbox so
the Conversation tab can show the same report without opening the job summary.

## Tuned Contract: Out-Of-Scope Edit

Fixture:

```text
fixtures/unsafe-pr-zoo/out-of-scope-agent-edit
```

Replay:

```bash
pnpm --filter mergewarden build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/out-of-scope-agent-edit
```

This fixture demonstrates tuned-policy contract evidence for an agent pull
request that edits outside its declared `allowed_paths`.
