# Demo PRs

This page collects concrete MergeWarden examples. Live sandbox pull requests are
separate from local replay fixtures and are not external adopter claims.

Proofs recorded before v0.4.0 ran under the project's former name, Agent Gate.
Their linked runs, screenshots, and `sjh9714/Agent-Gate` Action refs keep the
historical name; the old repository URL redirects to `sjh9714/mergewarden`.

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
