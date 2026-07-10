# External Install Smoke: v0.1.5

This document records an external install smoke for Agent Gate `v0.1.5`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/3
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/27641460493
- Action ref: `sjh9714/Agent-Gate@v0.1.5`

## Installation Shape

- Repository visibility: public
- Workflow trigger: `pull_request`
- Checkout step: not used
- Observed token permissions:
  - `contents: read`
  - `pull-requests: read`
- Action mode: `warn`
- `fail-on-block`: `false`

## Result

- Check conclusion: success
- Pull request state after smoke: open and unmerged
- Existing sandbox pull requests #1 and #2 were not modified
- GitHub Actions log confirmed `sjh9714/Agent-Gate@v0.1.5` loaded from tag
  target `2b18228b32ac50186d86a76ec4a7f941a1facc6c`
- Final decision: `warn`
- Risk score: `100 / 100`

## Log Markers Observed

- `Agent Gate: NEEDS HUMAN DECISION`
- `Decision: warn`
- `Risk score: 100 / 100`
- `Why: .github/workflows/agent-gate.yml changed outside the allowed contract scope.`
- `Recommended next step: Review or split the out-of-scope file changes before merging.`
- `Policy status: warning today; eligible to become a merge gate after tuning.`
- `Findings:`

## Findings Exercised

- `contract/out-of-scope`
- `risk/high-risk-path`
- `workflow/permission-escalation`
- `workflow/dangerous-pattern`

## Friction Check

- `gh run --log` showed the compact plain-text Agent Gate summary.
- The smoke log did not show a Node.js 20 deprecation warning.
- The Markdown report remains written through the existing GitHub job summary
  code path.

## Follow-Up Candidate

- Consider whether the compact log summary should include a direct report
  artifact path or PR comment URL when those are available.
