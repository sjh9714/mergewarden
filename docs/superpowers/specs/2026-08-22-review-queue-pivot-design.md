# Public review queue pivot

## Problem

The public PR risk scanner solved a real but infrequent problem. A sample of twenty recent agent-assisted pull requests produced no warning or error findings. Boundary-targeted pull requests produced findings, but many repeated facts already visible in the changed file list.

Recent maintainer evidence points to a more frequent problem. Reviewers must decide whether an external contribution is relevant, prepared, and likely to receive follow-through before they inspect the code. Ghostty, PyTorch, OpenXLA, and Gitea now publish explicit AI contribution policies around disclosure, author understanding, concise changes, tests, and template compliance. GitHub is also shipping coarse contribution controls, while maintainers still ask for deterministic PR-level context in the queue.

MergeWarden already has most of the required logic in its hidden `triage` command. The product should expose that working capability before adding another detector.

## Product decision

The Pages homepage becomes a public review queue for a repository. A maintainer pastes a public GitHub repository URL and sees the latest external pull requests ordered by missing review context.

The existing single PR risk scan remains available through the same input and from every queue row. It becomes the detailed second step instead of the homepage promise.

## First use flow

1. Paste `https://github.com/owner/repository` or `owner/repository`
2. Read up to thirty recent open pull request summaries
3. Exclude known maintenance automation and trusted repository roles
4. Load details for at most ten external pull requests
5. Show repository-wide norms once and rank the remaining rows by fact count
6. Open the pull request on GitHub or run the existing detailed risk scan

The same input continues to accept a full pull request URL or `owner/repository#number`.

## Facts shown

No new analysis rule is added.

- No linked issue
- Description below the existing prose threshold
- Pull request template not followed
- Change over the existing file or line threshold
- First contribution as context only

The result never calls a contribution spam, low quality, or AI generated. It never closes, labels, scores, or comments on a pull request.

## Trust and queue filtering

Pull requests from `OWNER`, `MEMBER`, and `COLLABORATOR` roles are counted as trusted and left out of the external review queue. Authors listed in the existing `triage.exclude_authors` default are counted as maintenance automation and left out too.

`CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, `FIRST_TIMER`, and `NONE` remain in the queue. Unknown role values remain visible rather than being silently trusted.

The browser fetch adapter must collect author association. The Action payload adapter stays unchanged in this slice because enabling a previously inert informational rule would change current Action output.

## API budget

The browser makes one list request, at most ten detail requests, and at most three base-branch template requests. The worst case is fourteen requests per repository scan, within GitHub's anonymous sixty request hourly budget for several normal scans.

Requests do not retry in the browser. A rate limit produces the existing authenticated CLI fallback.

The queue loader fetches only metadata and the base pull request template. It does not fetch changed file contents, run repository code, call an LLM, or store data.

## Shared architecture

`@mergewarden/github` owns repository target parsing and public pull request listing. `FetchGitHubApi` maps author association and optional line totals from GitHub responses.

`@mergewarden/core` owns the triage rules and repository norm suppression. The web package owns its four short queue labels.

`packages/web` owns queue orchestration and presentation. It constructs metadata-only analysis inputs and runs the existing deterministic triage rules. Full risk analysis still uses `loadGitHubAnalysis` only for an individual PR.

## Interface

The hero copy becomes the following.

```text
See which pull requests need context before code review.

Paste a public GitHub repository. MergeWarden surfaces missing issue links,
thin descriptions, skipped templates, and oversized changes. No login. No AI.
```

The desktop layout keeps the current input and result split. The example changes from a rare workflow escalation to an external PR queue with three rows. Mobile remains a single column.

Queue rows show the PR number, title, author, role context, changed files and lines, updated time, and deterministic notes. The title links to GitHub. A secondary action opens the detailed PR scan.

The existing risk result and Action installation block remain unchanged.

## Errors and incomplete results

Invalid repository input, missing or private repositories, rate limit, network failure, and partial queue reads remain distinct states.

If any selected external pull request cannot be read, the page says the queue is incomplete and does not present it as a clean result. Successfully read rows remain visible.

## Validation

Automated tests cover parsing, GitHub response mapping, trusted and automation filtering, queue ordering, repository norm suppression, partial reads, hash links, and regression of the existing PR scan.

Browser checks use desktop and mobile sizes, keyboard-only navigation, a repository with external pull requests, an automation-heavy repository, an invalid target, a missing repository, and a shared hash reload.

The initial live acceptance set is `ghostty-org/ghostty`, `pytorch/pytorch`, and `openxla/xla`. Trusted maintainers and maintenance bots must not dominate the queue.

## Release and stop condition

The change ships through the existing Pages workflow after CI passes. No npm release, Action behavior change, GitHub App, backend, authentication, telemetry, or promotion is included.

After deployment, ten maintainers with active external queues are shown their own queue result. Promotion remains stopped. If fewer than three say the ordering saves review time, the queue does not become the permanent product direction.
