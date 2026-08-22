# Roadmap

The roadmap follows observed user value rather than promised dates.

## Shipped

Through v0.10.4 and the public web rollout.

- A no-login browser queue for recent external PRs in public repositories.
- Trusted repository roles, base repository branches, and known maintenance
  automation are removed before detailed requests are spent.
- Repository-wide facts are shown once instead of repeated on every queue row.
- A detailed public PR scan remains available through every row and a shareable
  hash link.
- A checkout-free CLI and Action using the same deterministic analysis engine.
- Focused findings for workflow permissions, coding-agent instructions,
  untrusted prompt inputs, and install-time scripts.
- Stable finding IDs, policy digests, evidence snapshots, and expiring waivers.
- Explicit incomplete-analysis reporting when GitHub evidence is missing.
- An MCP interface for checking agent work before a PR exists.

## Next

- Put the deployed queue in front of ten maintainers with active external PRs.
- Require three confirmations that the ordering saves review time before making
  the queue the permanent product direction.
- Keep promotion stopped until that usefulness threshold is reached.
- If rows discriminate but maintainers do not save time, stop changing the UI
  and revisit the problem.
- If maintainers find the queue useful but do not return, fix repeat access and
  trust friction before adding a rule.

## Later

- Private repository support only after repeated requests and external installs.
- A GitHub App only after maintainers ask for a persistent queue and the public
  browser flow has proven useful.
- Version 2 policy format after v1 compatibility requirements are understood.
- Broader data-flow rules only when they remain deterministic and explainable.

## Explicit non-goals

- Runtime LLM judgment by default.
- Executing or checking out PR-controlled code.
- A backend, database, account system, or built-in telemetry before demand is
  demonstrated.
- Claims that MergeWarden proves semantic correctness or replaces code review.
- Automatic closing, labeling, commenting, contributor scoring, or AI-generated
  text detection in the review queue.
