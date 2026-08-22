# Public Review Queue Implementation Plan

> Agentic workers must use `superpowers:executing-plans` and complete the checkboxes in order.

**Goal**

Make the Pages homepage rank recent external pull requests by deterministic missing review context while retaining the existing individual PR risk scan.

**Architecture**

The shared GitHub package parses repository targets and lists recent open pull requests. The web package filters trusted roles and maintenance automation, fetches details for at most ten external pull requests, runs existing triage rules on metadata-only inputs, and renders the ordered queue. The existing full PR loader remains unchanged for individual risk scans.

**Tech stack**

TypeScript, React 19, Vite 8, Tailwind CSS 4, Zod, Vitest, GitHub REST API

**Spec**

`docs/superpowers/specs/2026-08-22-review-queue-pivot-design.md`

## Global constraints

- Add no production dependency
- Add no analysis rule
- Preserve existing CLI, Action, finding IDs, policy digests, and single PR results
- Make at most fourteen anonymous GitHub requests for a normal queue scan
- Never execute, check out, store, or transmit pull request code
- Keep promotion stopped until maintainer usefulness is measured

---

### Task 1  Shared repository targets and listing

**Files**

- Create `packages/github/src/repositoryTarget.ts`
- Modify `packages/github/src/fetch.ts`
- Modify `packages/github/src/types.ts`
- Modify `packages/github/src/index.ts`
- Create `packages/github/test/repositoryTarget.test.ts`
- Modify `packages/github/test/fetch.test.ts`

**Interfaces**

- Produce `RepositoryLocator`
- Produce `parseRepositoryTarget(value: string): RepositoryLocator`
- Produce `RemoteOpenPullRequest`
- Produce `FetchGitHubApi.listOpenPullRequests(target: RepositoryLocator, limit: number): Promise<RemoteOpenPullRequest[]>`
- Extend `RemotePullRequest` with optional `additions`, `deletions`, `updatedAt`, and `htmlUrl`
- Populate the existing optional `authorAssociation`

- [x] Write parser tests for `owner/repo`, a full repository URL, a PR URL rejection, credentials, query strings, fragments, and invalid names
- [x] Run `pnpm --filter @mergewarden/github test -- repositoryTarget.test.ts` and confirm failure because the parser does not exist
- [x] Implement the parser with the same GitHub host and credential restrictions as `parsePullRequestTarget`
- [x] Add fetch tests that map `author_association`, `additions`, `deletions`, `updated_at`, and `html_url`
- [x] Add a list test that verifies `state=open`, `sort=updated`, `direction=desc`, a bounded `per_page`, and normalized response fields
- [x] Run `pnpm --filter @mergewarden/github test` and confirm all GitHub package tests pass
- [x] Commit with `git commit -m "Add repository queue API"`

### Task 2  Shared repository norm suppression

**Files**

- Create `packages/core/src/triage/queue.ts`
- Modify `packages/core/src/index.ts`
- Create `packages/core/test/triage/queue.test.ts`
- Modify `packages/cli/src/triage.ts`
- Modify `packages/cli/test/triage.test.ts`

**Interfaces**

- Produce `partitionUniformTriageNotes<T extends { notes: string[] }>(rows: T[]): { uniform: string[]; rows: T[] }`
- Preserve the existing threshold of eighty percent from eight pull requests upward
- Replace the CLI-local implementation without changing CLI output

- [x] Move the three existing uniform-note cases into a core test and add a type-preservation case carrying a PR number
- [x] Run `pnpm --filter @mergewarden/core test -- queue.test.ts` and confirm failure because the helper does not exist
- [x] Implement the pure helper with the existing constants and no GitHub dependency
- [x] Replace `partitionUniformNotes` in the CLI with the shared import
- [x] Run `pnpm --filter @mergewarden/core test` and `pnpm --filter mergewarden test -- triage.test.ts`
- [x] Commit with `git commit -m "Share triage queue normalization"`

### Task 3  Public repository queue orchestration

**Files**

- Create `packages/web/src/triage.ts`
- Create `packages/web/test/triage.test.ts`

**Interfaces**

- Produce `PublicTriageRow`
- Produce `PublicTriageResult`
- Produce `triagePublicRepository(value: string, dependencies?: TriageDependencies): Promise<PublicTriageResult>`
- Consume `FetchGitHubApi.listOpenPullRequests`, `FetchGitHubApi.getPullRequest`, `FetchGitHubApi.getTextFile`, `analyze`, `DEFAULT_CONFIG`, `parseContractFromPrBody`, and `partitionUniformTriageNotes`

- [ ] Write a failing test that filters `OWNER`, `MEMBER`, `COLLABORATOR`, `dependabot[bot]`, `renovate[bot]`, and `github-actions[bot]`
- [ ] Write a failing test that keeps `CONTRIBUTOR`, first-time roles, `NONE`, and unknown roles
- [ ] Write a failing test that lists thirty summaries but loads details for no more than ten external pull requests
- [ ] Write a failing test that maps only the four readiness rules to queue notes and keeps first-contribution status as context
- [ ] Write a failing test for most-facts-first ordering and repository norm suppression
- [ ] Write a failing test that retains readable rows while setting `analysisComplete` false and recording unreadable PR numbers
- [ ] Implement metadata-only analysis inputs with no `analysis` field, no changed files, existing totals, the base template, and a cloned default config with `no_linked_issue` set to `info`
- [ ] Load details in batches of three and fetch the base pull request template once from the existing three supported paths
- [ ] Run `pnpm --filter @mergewarden/web test -- triage.test.ts` and confirm all queue tests pass
- [ ] Commit with `git commit -m "Add public review queue"`

### Task 4  Homepage queue interface and product copy

**Files**

- Create `packages/web/src/QueueResult.tsx`
- Modify `packages/web/src/App.tsx`
- Modify `packages/web/src/product.ts`
- Modify `packages/web/src/styles.css`
- Modify `packages/web/test/presentation.test.ts`
- Modify `README.md`
- Modify `README.zh-CN.md`
- Modify `docs/getting-started.md`
- Modify `docs/roadmap.md`
- Modify `packages/cli/package.json`

**Interfaces**

- Extend the hash contract with `#repo=<encoded target>` while retaining `#pr=<encoded target>`
- Detect repository input first and PR input when the value contains a PR number or pull request URL
- Render GitHub and detailed scan links as ordinary anchors

- [ ] Add presentation tests for repository hash round trips, input classification, queue copy, and existing PR hash regression
- [ ] Run `pnpm --filter @mergewarden/web test -- presentation.test.ts` and confirm the new assertions fail
- [ ] Change the hero to the exact copy in the spec and accept a repository or PR in one labelled input
- [ ] Render queue summary counts, repository norms, incomplete state, rows, GitHub links, and detailed scan links
- [ ] Replace the example risk card with a three-row external review queue
- [ ] Add visible focus, mobile layout, reduced motion, and queue skeleton styles without a new component library
- [ ] Keep the existing single PR result and installation block unchanged
- [ ] Reorder English and Chinese README content around the public review queue, then place individual PR risk scan and Action installation after it
- [ ] Update getting started, roadmap, and npm description without claiming market validation
- [ ] Run web tests, typecheck, lint, and build
- [ ] Commit with `git commit -m "Lead with external PR triage"`

### Task 5  Full verification and deployed acceptance

**Files**

- Modify only files required by failures found in this task

**Interfaces**

- Preserve all published package and Action contracts

- [ ] Run `pnpm install --frozen-lockfile`
- [ ] Run `pnpm test`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm build`
- [ ] Run `pnpm format:check`
- [ ] Run `pnpm audit --audit-level high`
- [ ] Run `git diff --exit-code -- packages/action/dist/index.cjs`
- [ ] Start the built Pages site and verify 1440 by 900 and 375 by 812 layouts
- [ ] Verify keyboard navigation, focus visibility, reduced motion, repository hash reload, PR hash reload, invalid target, missing repository, and rate limit presentation
- [ ] Verify `ghostty-org/ghostty`, `pytorch/pytorch`, and `openxla/xla` without trusted maintainers or maintenance bots dominating the external queue
- [ ] Review the final diff for unrelated changes and prose containing em dashes
- [ ] Push `codex/review-queue`, open a pull request, and wait for every required CI check
- [ ] Merge only after CI passes, verify Pages deployment, and repeat one live repository queue scan
- [ ] Update the GitHub repository description only after the deployed queue works
