# v0.1.0 Release Readiness Audit

This document records the final pre-release audit for a future Agent Gate
`v0.1.0` release. It is an audit template only. Do not create tags, GitHub
releases, package publishes, repository settings, or runtime changes from this
document.

## Release Target

- Target: `v0.1.0`
- Current `main` commit: record the audited commit SHA before tagging.
- Release state: not released.

## Checks Run

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm format:check`
- [ ] `git diff --exit-code -- packages/action/dist/index.cjs`
- [ ] GitHub Agent Gate check
- [ ] GitHub CI check
- [ ] GitGuardian check

## Unsafe PR Zoo Replay

- [ ] `fixtures/unsafe-pr-zoo/workflow-permission-escalation`
- [ ] `fixtures/unsafe-pr-zoo/agent-control-plane-drift`
- [ ] `fixtures/unsafe-pr-zoo/out-of-scope-agent-edit`
- [ ] `fixtures/unsafe-pr-zoo/missing-test-evidence`
- [ ] `fixtures/unsafe-pr-zoo/mcp-config-drift`

## Action Packaging

- [ ] Root `action.yml` points to `packages/action/dist/index.cjs`.
- [ ] `packages/action/action.yml` points to `dist/index.cjs`.
- [ ] Root and package-local Action metadata are in sync.
- [ ] `packages/action/dist/index.cjs` is committed and fresh.
- [ ] Node 20 Action bundle smoke test passes in CI.
- [ ] Self-dogfooding Agent Gate workflow remains checkout-free.

## Docs Checklist

- [ ] `README.md` install and replay sections are current.
- [ ] `CHANGELOG.md` has an accurate `Unreleased` section.
- [ ] `docs/v0.1.0-release-notes.md` is reviewed.
- [ ] `docs/security-model.md` is reviewed.
- [ ] `docs/repository-governance.md` is reviewed.
- [ ] `docs/release-checklist.md` is reviewed.

## Known Blockers

- Record any release blockers here before tagging.
- If there are no known blockers after audit, record `None`.

## Go / No-Go Recommendation

- Recommendation: record `Go` or `No-go` after completing the audit.
- Reviewer:
- Date:
- Notes:
