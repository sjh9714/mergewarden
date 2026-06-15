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

For AI-generated PRs, add an `agent-gate-contract` block to the PR body only
when you want scope enforcement for this PR.

Do not leave placeholder contracts in the PR body. See README for the contract
format.
