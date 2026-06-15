# Contributing

Thanks for your interest in Agent Gate.

Agent Gate is a prerelease, deterministic-first CI firewall for AI-generated
pull requests. It is designed to explain policy decisions with repeatable
evidence, not runtime LLM judgment.

## Before You Start

For larger changes, please open an issue first so we can align on scope and
expected behavior before implementation.

Good first contribution areas include documentation clarity, replay fixtures,
report wording, and focused rule tests.

## Local Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

## Rule Changes

Every new rule should include fixture-based tests.

At minimum, assert the exact:

- `ruleId`
- `severity`
- `decision`

If a finding is user-facing, include Markdown report coverage as well.

## Safety Constraints

Do not add:

- runtime LLM calls by default
- checkout or execution of PR-controlled code in the GitHub Action
- repository script execution from untrusted PR content
- production dependencies without clear justification

Root `action.yml`, `packages/action/action.yml`, and the committed Action
bundle should stay aligned when Action behavior changes.
