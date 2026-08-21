# Roadmap

The roadmap is ordered by evidence quality, not promised dates.

## Shipped

Through v0.10.4. The [changelog](../CHANGELOG.md) has every release; this is the
shape of what exists.

- A public `npx` path, and a checkout-free Action that fails closed when it
  cannot collect the files it needs.
- Workflow findings that compare against the base branch rather than restating
  pre-existing conditions, each independently tunable, with exact and expiring
  base-policy waivers.
- Reporting when a pull request changes the files coding agents read as
  instructions, and a narrow documented class of agentic workflow injection.
- `mergewarden triage`, which reads a repository's open pull requests and
  reports what each is missing without writing anything back.
- Identification of the co-author trailers coding tools write about themselves,
  matched on exact address rather than domain or display name.
- A quiet default: the Action says nothing when there is nothing to say.

## Next

- Measure false-positive rates with three external design partners and publish
  only consented results.
- Confirm at least one public external installation and turn its setup or noise
  into reproducible adopter proof.
- Add contributor-owned replay fixtures for reusable-workflow and container
  pinning before expanding rule behavior.
- Expand the agent-action registry only from official, testable contracts.
- Improve reviewer/CODEOWNERS evidence only after the existing RFC receives
  concrete maintainer feedback.

## Later

- Version 2 policy format after v1 compatibility requirements are understood.
- Broader cross-step agentic-workflow data-flow analysis if it remains
  deterministic and explainable.
- Dependency and lockfile policy families.

## Explicit Non-Goals

- Runtime LLM judgment by default.
- Executing or checking out PR-controlled code in the Action.
- A hosted SaaS, GitHub App, or built-in usage telemetry.
- Claims that MergeWarden proves semantic correctness.
