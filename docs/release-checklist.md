# Release Checklist

This checklist prepares Agent Gate for a future `v0.1.0` pre-release. Do not
create tags, GitHub releases, or package publishes from Codex unless the user
explicitly asks for that release operation.

## Pre-Release Quality Gate

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm format:check`.
- [ ] Run `git diff --exit-code -- packages/action/dist/index.cjs`.
- [ ] Run CLI replay for every fixture under `fixtures/unsafe-pr-zoo`.

## GitHub Checks

- [ ] Confirm the Agent Gate check succeeds.
- [ ] Confirm the CI check succeeds.
- [ ] Confirm GitGuardian succeeds.
- [ ] Confirm repository governance settings are reviewed before release.
- [ ] Confirm Agent Gate findings, if any, are expected and non-blocking for the
      release-prep PR.

## Action Packaging

- [ ] Verify root `action.yml` points to `packages/action/dist/index.cjs`.
- [ ] Verify `packages/action/action.yml` points to `dist/index.cjs`.
- [ ] Verify root `action.yml` and `packages/action/action.yml` expose matching
      inputs, outputs, branding, and Node runtime.
- [ ] Verify `packages/action/dist/index.cjs` is committed.
- [ ] Confirm the Node 20 Action bundle smoke test passes in CI.
- [ ] Verify `.github/workflows/agent-gate.yml` does not use
      `actions/checkout`.

## README And Install Docs

- [ ] Verify the install example uses `sjh9714/Agent-Gate@<ref>` and remains
      checkout-free.
- [ ] Verify comment examples document `issues: write`.
- [ ] Verify README still describes Agent Gate as pre-release.
- [ ] Verify docs do not claim marketplace availability or package publishing.

## Security Model

- [ ] Review `docs/security-model.md`.
- [ ] Confirm trusted and untrusted inputs are still accurate.
- [ ] Confirm runtime guarantees still match the Action implementation.
- [ ] Confirm known limitations are still accurate.

## Tagging Plan

- [ ] Choose the release ref, such as `v0.1.0`.
- [ ] Confirm the release commit is on `main`.
- [ ] Review `docs/v0.1.0-release-notes.md` before tagging.
- [ ] Create a draft release note from `CHANGELOG.md`.
- [ ] Do not push the tag until final verification is complete.

## Post-Release Verification

- [ ] Create a test PR using `sjh9714/Agent-Gate@<tag>` after tagging.
- [ ] Confirm the root Action loads on GitHub runners.
- [ ] Confirm the job summary and outputs are written.
- [ ] Confirm optional PR comment upsert works when `issues: write` is granted.
- [ ] Confirm fork PR comment failures remain warnings, not Action failures.
