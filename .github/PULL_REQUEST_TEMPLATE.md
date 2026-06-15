## Summary

<!-- What changed, and why? -->

## Verification

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm format:check`
- [ ] `git diff --exit-code -- packages/action/dist/index.cjs` if Action behavior or packaging changed

## Checklist

- [ ] Added or updated docs/changelog for user-facing changes
- [ ] Added fixture-based tests for new or changed rules
- [ ] Confirmed JSON decisions remain compatible, or documented the breaking change
- [ ] No tags, releases, package publishing, repository settings, or Marketplace settings changed unless explicitly intended

## Optional Agent Gate Contract

<!-- agent-gate-contract
version: 1
agent: codex
task: describe the intended change
allowed_paths:
  - README.md
required_evidence:
  - relevant tests or docs updated
-->
