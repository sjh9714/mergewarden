# External Install Smoke: v0.1.4

This document records an external install smoke for Agent Gate `v0.1.4`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/2
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/27638625617
- Action ref: `sjh9714/Agent-Gate@v0.1.4`

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
- Existing sandbox pull request #1 was not modified
- GitHub Actions log confirmed `sjh9714/Agent-Gate@v0.1.4` loaded from tag
  target `1f7d139cc020c794a26231a24b5d0431d9bc8154`

## Findings Exercised

- The smoke PR intentionally changed workflow files outside the PR contract
  scope.
- The smoke PR added `.github/workflows/release.yml` with
  `permissions: contents: write`.
- The smoke PR referenced `secrets.*` in the release workflow.
- The PR body contract allowed only `src/auth/**` and `tests/auth/**`.

## Friction Check

- The `v0.1.3` smoke showed GitHub's Node.js 20 deprecation warning.
- The `v0.1.4` smoke log did not show a Node.js 20 deprecation warning.
- The Markdown report remains visible through the GitHub run summary UI, but
  `gh run --log` and Check Run API output do not expose the full report body.

## Follow-Up Candidate

- Consider logging a compact plain-text Agent Gate summary for `gh run --log`
  and API-based debugging.
