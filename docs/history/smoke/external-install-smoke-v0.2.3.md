# External Install Smoke: v0.2.3

This document records an external install smoke for Agent Gate `v0.2.3`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/9
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/28220002100
- Action ref: `sjh9714/Agent-Gate@v0.2.3`

## Installation Shape

- Repository visibility: public
- Workflow trigger: `pull_request`
- Checkout step: not used
- Observed token permissions:
  - `contents: read`
  - `pull-requests: read`
- Action mode: `warn`
- `fail-on-block`: `false`
- Default base-branch `agent-gate.yml`: absent
- Existing sandbox pull requests #1 through #8 were not modified.

## Result

- Check conclusion: success
- Pull request state after smoke: open and unmerged
- GitHub Actions log confirmed `sjh9714/Agent-Gate@v0.2.3` loaded.
- Final decision: `pass`
- Risk score: `0 / 100`

## Zero-Config Verification

- The log showed the expected warning:
  `Agent Gate could not load agent-gate.yml from the base branch; using built-in default policy.`
- The JSON report included `configSource: default`.
- The Markdown report included `Policy source: built-in default`.
- The smoke workflow verified both report markers without checking out PR code.

## Log Markers Observed

- `Agent Gate: PASSED`
- `Decision: pass`
- `Risk score: 0 / 100`
- `Why: No warning or blocking findings were detected.`
- `Recommended next step: No action needed beyond normal review.`
- `Policy status: no blocking or warning findings.`

## Friction Check

- The smoke log did not show an `actions/checkout` step.
- The smoke log did not show a Node.js 20 deprecation warning.

## Related Pre-Ready Smoke

Before PR #68 was merged, exact-SHA smoke runs verified:

- confirmed-missing default `agent-gate.yml` falls back to built-in defaults
- missing explicit custom config path fails fast
- invalid base-branch `agent-gate.yml` fails fast
