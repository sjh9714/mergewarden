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

## Product status, 2026-09-10

Product expansion is on hold. The queue experiment has not demonstrated time
saved or repeat maintainer use. Generating different rows is not evidence that
their ordering improves a maintainer's decisions. The studies remain available
with those limits stated explicitly.

The current work is limited to correcting known evidence-reporting defects,
dependency updates, and compatibility tests. No new feature or release dates
are promised. This is not a promise of ongoing maintenance.

## Existing alternatives

- GitHub provides [per-user open PR limits](https://github.blog/changelog/2026-06-17-limit-open-pull-requests-for-users-without-write-access/)
  and [contributor role labels in the PR list](https://github.blog/changelog/2026-04-09-repository-member-role-labels-now-in-pull-request-list-view/).
- [CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
  requests file-owner reviews without a separate scanning page.
- [zizmor](https://docs.zizmor.sh/audits/) provides focused workflow security
  checks and existing CI and editor integrations.

These do not duplicate every MergeWarden rule. They do raise the bar for asking
maintainers to install another check or return to a separate queue.

## What would justify revisiting the product

A maintainer would need to identify a recurring decision their existing tools
do not support, demonstrate it on real PRs, and use a small comparison to show
that MergeWarden improves that decision. Continued use matters more than a
positive reply. No new outreach campaign, paid service, GitHub App, private
repository integration, or broader scanner is planned to manufacture this
evidence.

## Explicit non-goals

- Runtime LLM judgment by default.
- Executing or checking out PR-controlled code.
- A backend, database, account system, or built-in telemetry before demand is
  demonstrated.
- Claims that MergeWarden proves semantic correctness or replaces code review.
- Automatic closing, labeling, commenting, contributor scoring, or AI-generated
  text detection in the review queue.
