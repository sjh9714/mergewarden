# Roadmap

The roadmap follows observed user value rather than promised dates.

## Shipped

Through v0.10.4 and the public scanner rollout.

- A no-login browser scan for public GitHub PRs with shareable hash links.
- A checkout-free CLI and Action using the same deterministic analysis engine.
- Focused findings for workflow permissions, coding-agent instructions,
  untrusted prompt inputs, and install-time scripts.
- Stable finding IDs, policy digests, evidence snapshots, and expiring waivers.
- Explicit incomplete-analysis reporting when GitHub evidence is missing.
- Advanced queue triage and MCP interfaces without putting them in the first-use
  path.

## Next

- Scan 20 recent public PRs from repositories using both coding agents and
  GitHub Actions.
- Ask maintainers about specific useful findings and publish only consented
  examples.
- Reach three external Action installations before adding another rule family.
- Fix installation or trust friction first if useful findings do not convert to
  installs.
- Revisit the problem and current rules if fewer than three of the 20 eligible
  PRs produce a useful finding.

## Later

- Private repository support only after repeated requests and external installs.
- A GitHub App only when browser and Action installation no longer cover the
  proven workflow.
- Version 2 policy format after v1 compatibility requirements are understood.
- Broader data-flow rules only when they remain deterministic and explainable.

## Explicit non-goals

- Runtime LLM judgment by default.
- Executing or checking out PR-controlled code.
- A backend, database, account system, or built-in telemetry before demand is
  demonstrated.
- Claims that MergeWarden proves semantic correctness or replaces code review.
