# Demo PRs

This page collects concrete Agent Gate examples. The first example is a live
sandbox pull request. The later examples are local replay fixtures, not live
external pull requests.

## First-Run Default Policy

- Pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/11
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/28232902050
- Smoke record: `docs/external-install-smoke-v0.2.5.md`
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

Fixture:

```text
fixtures/unsafe-pr-zoo/workflow-permission-escalation
```

Replay:

```bash
pnpm --filter agent-gate build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation
```

This fixture demonstrates deterministic workflow evidence such as
`workflow/permission-escalation` and `workflow/dangerous-pattern`.

## Tuned Contract: Out-Of-Scope Edit

Fixture:

```text
fixtures/unsafe-pr-zoo/out-of-scope-agent-edit
```

Replay:

```bash
pnpm --filter agent-gate build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/out-of-scope-agent-edit
```

This fixture demonstrates tuned-policy contract evidence for an agent pull
request that edits outside its declared `allowed_paths`.
