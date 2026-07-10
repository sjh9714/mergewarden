# External Install Smoke: v0.2.0

This document records an external install smoke for Agent Gate `v0.2.0`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/4
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/27744122824
- Action ref: `sjh9714/Agent-Gate@v0.2.0`

## Installation Shape

- Repository visibility: public
- Workflow trigger: `pull_request`
- Checkout step: not used
- Observed token permissions:
  - `contents: read`
  - `pull-requests: read`
- Action mode: `warn`
- `fail-on-block`: `false`
- Existing sandbox pull requests #1, #2, and #3 were not modified.

## Result

- Check conclusion: success
- Pull request state after smoke: open and unmerged
- GitHub Actions log confirmed `sjh9714/Agent-Gate@v0.2.0` loaded.
- Final decision: `warn`
- Risk score: `100 / 100`
- The smoke added a no-checkout diagnostic step that greps Agent Gate report
  files written by the Action. It does not checkout PR code or run repository
  scripts.

## Log Markers Observed

- `Agent Gate: NEEDS HUMAN DECISION`
- `Decision: warn`
- `Risk score: 100 / 100`
- `Why: .github/workflows/agent-gate.yml changed outside the allowed contract scope.`
- `Recommended next step: Review or split the out-of-scope file changes before merging.`
- `Policy status: warning today; eligible to become a merge gate after tuning.`
- Compact finding lines included `agf_[0-9a-f]{16}` finding IDs.

## Report ID Verification

- `gh run --log` showed compact finding lines such as
  `- error agf_ac33166627bbc9e0 workflow/permission-escalation .github/workflows/release.yml`.
- The Markdown report file included `Finding ID` entries with `agf_...` values.
- The JSON report file included `findings[].findingId` values with `agf_...`
  values.

## Findings Exercised

- `agent/origin-detected`
- `contract/out-of-scope`
- `risk/high-risk-path`
- `workflow/permission-escalation`
- `workflow/dangerous-pattern`

## Friction Check

- The smoke log did not show a Node.js 20 deprecation warning.
- The smoke log did show a GitHub REST contents API deprecation warning from
  Octokit while fetching changed workflow content. This is separate from the
  previous Node runtime warning and should be evaluated as future maintenance.

## Follow-Up Candidate

- Review the GitHub contents API deprecation warning before the scheduled 2028
  removal window.
