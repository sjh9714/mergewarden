# Contributing

Thanks for helping improve MergeWarden for AI-generated pull requests.

## Five-Minute Setup

```bash
corepack enable
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

Good first contributions include clearer reports, focused fixtures, rule docs,
and reproductions of noisy policy behavior. Open an issue before large changes
so the trust boundary and compatibility impact can be agreed first.

## Fixture Recipe

Every new or changed rule needs:

1. One fixture that must pass.
2. One fixture that must produce a finding.
3. Exact `ruleId`, severity, and decision assertions.
4. A stored Markdown snapshot for user-facing output.
5. A short rule guide describing evidence, remediation, and false-positive
   boundaries.

Fixtures are data only. Tests must never execute fixture scripts or workflow
expressions.

## Pull Requests

- Keep changes small and explain compatibility decisions.
- Update `CHANGELOG.md` for user-visible behavior.
- Update both Action manifests and rebuild the committed bundle when Action
  contracts change.
- Do not add production dependencies without updating `AGENTS.md` and
  explaining why.
- Include the commands you ran and any intentionally deferred validation.

## Safety Constraints

Do not add runtime LLM calls by default, checkout or execution of target PR
code, head-branch policy loading, executable YAML extensions, target repository
package execution, or hidden nondeterministic policy decisions.
