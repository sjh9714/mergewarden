# Changelog

All notable changes to MergeWarden (formerly Agent Gate) will be documented in
this file.

This project follows the spirit of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## v0.5.1 - 2026-07-25

### Fixed

- **The default Claude Code body marker matched nothing.** `DEFAULT_AGENT_BODY_PATTERNS`
  shipped the plain string `Generated with Claude Code`, but Claude Code's real footer
  is `🤖 Generated with [Claude Code](https://claude.com/claude-code)` — the product
  name sits inside a Markdown link, so that substring never occurs in an actual pull
  request body. Measured against 13 real Claude Code pull requests taken from the scan
  study: the old default matched **0 of 13**, the corrected
  `Generated with [Claude Code]` matches **12 of 13** (the remaining one had its footer
  edited out before merge). The plain form is kept as a fallback.

  This matters more than the other markers: Codex, Cursor, Copilot and Devin pull
  requests are caught by branch or author, but Claude Code usually runs on a
  developer's own machine and pushes to an ordinary branch name, so the body footer is
  often the only signal available.

### Changed

- `docs/study/methodology.md` now states which of the study's rates carry across engine
  versions and which do not. The per-rule boundary rates (3.9%, 12.9%, 17.5%, 22.1%) are
  unaffected by the v0.5.0 detection fix — verified by re-scanning a 66-PR stratified
  sample of the dataset under the new defaults, which produced identical boundary
  findings on 66 of 66. The "at least one finding" rate and the star-band comparison are
  boundary-crossing rates and are not comparable to a v0.5.0+ run, which would add
  `contract/missing` to nearly the whole corpus.

## v0.5.0 - 2026-07-25

### Added

- **`mergewarden demo`** — analyzes an example pull request bundled inside the CLI,
  with no network call, no token and no repository. It runs the **default** policy,
  so the 13 findings it reports are a verifiable statement about what a
  zero-configuration install does rather than a showcase arranged by a bespoke
  fixture config. The example is an agent pull request that declares
  `allowed_paths: docs/**` and then edits a release workflow, `AGENTS.md` and
  `package.json`, which is enough to demonstrate contract scope, control-plane
  drift, workflow permission escalation, prompt injection into an agentic workflow,
  and an added lifecycle script in a single report. Accepts
  `--format human|json|markdown`.

### Changed

- **Agent detection now ships working defaults.** `agent_detection.authors`,
  `branch_patterns` and `body_patterns` previously defaulted to empty arrays, which
  meant a zero-config install could never detect an agent pull request — and because
  `contract.required_for` defaults to `[agent]`, the project's headline check
  ("did the PR stay inside its declared scope?") was unreachable without configuration.
  Measured before this change: 14 of 14 recent merged pull requests from well-known
  public repositories returned `0 error, 0 warning, 0 info`. The defaults are now the
  cohort definitions from the [2,204-PR study](docs/study/methodology.md):
  `devin-ai-integration[bot]` and `copilot-swe-agent[bot]` authors, `codex/**`,
  `claude/**`, `cursor/**`, `copilot/**` and `devin/**` branches, and the
  `Generated with Claude Code` body marker.

  **This is a behaviour change.** A repository that relied on the empty defaults will
  now see `agent/origin-detected` (info) and, on agent pull requests without a declared
  contract, `contract/missing`. In the default `warn` mode that produces a
  `needs-review` decision, not a block. Pull requests from humans are unaffected. To
  restore the previous behaviour, set the keys explicitly to `[]`.

- **Agent control-plane defaults now cover Gemini and Qwen.** Added `GEMINI.md`,
  `**/GEMINI.md`, `QWEN.md`, `**/QWEN.md` and `.gemini/**` to
  `DEFAULT_AGENT_CONTROL_PLANE_PATHS`. GitHub indexes 8,208 `GEMINI.md` and 1,376
  `QWEN.md` files, so this was a real coverage hole: a pull request steering every
  future Gemini run was invisible. **This is a behaviour change** — these paths carry
  the `error` severity the rest of the control-plane list uses.

- Cut the pull request comment down to what a reviewer needs above the fold:
  the decision heading, one `Why` line with the path inline, one `Next` line,
  and one `Findings` line with the counts and policy status. A 12-finding
  report now shows 5 lines before the fold instead of 30. The run summary —
  agent detection, contract presence, policy source, file counts, policy
  digest — moves inside the `<details>` element rather than being dropped, and
  report files, job summaries and the CLI keep the full flat layout. Second
  round of feedback from the same maintainer evaluating MergeWarden on
  [microcks/.github#86](https://github.com/microcks/.github/issues/86), who
  pointed out that the first fix hid the findings but left the header
  restating the decision four times.

- The CLI's terminal report bounds itself to 10 findings; it now chooses those 10
  by severity instead of by evaluation order, so a report with more findings than
  fit can no longer hide every `error` behind warnings that happened to run first.
  `agent/origin-detected` is retained regardless of its `info` severity because it
  is what explains why the contract rules fired at all. The selected findings are
  still printed in evaluation order, and `--format json` and `--format markdown`
  are unaffected.

### Fixed

- Piping CLI output into a command that closes the pipe early — `| head`, or
  `| less` quit before the end — printed an unhandled `EPIPE` stack trace over
  the terminal. The CLI now exits quietly, as command-line tools are expected to.

## v0.4.1 - 2026-07-25

### Added

- Commit trailer rules: `commit/trailer-missing` and `commit/trailer-forbidden`,
  configured under `commit_trailers`. Real AI-contribution policies express
  disclosure as a commit trailer and disagree on which one — Fedora and Mesa
  require `Assisted-by:`, Kubernetes forbids it, QEMU and FreeBSD require a DCO
  `Signed-off-by:` — and all of those clauses are decidable from commit metadata
  alone. Both `required` and `forbidden` lists default to empty, so existing
  repositories see no decision change until they add an entry. See
  [the rule guide](docs/rules/commit-trailers.md).
- The GitHub collector now enumerates pull-request commits. When it cannot
  collect all of them — GitHub caps commit listing at 250 — it omits commits
  entirely and the trailer rules stay inert rather than run against a partial
  list that could only under-report. The CLI and Action print a warning.

### Changed

- Collapse the detailed findings in the pull request comment behind a `<details>`
  element. On a 12-finding report the comment drops from 371 rendered lines to 33
  before the fold, while the findings, evidence snapshots, finding IDs and
  remediation stay exactly where they were, one click away. Report files and job
  summaries are unchanged. Reported by a maintainer evaluating MergeWarden on
  [microcks/.github#86](https://github.com/microcks/.github/issues/86): a bot
  comment that long buries every other conversation on the page.
- The default policy digest changed because the configuration schema gained the
  `commit_trailers` key. Stored digests from earlier versions will differ; no
  finding IDs changed.

## v0.4.0 - 2026-07-21

### Changed

- Rename the project from Agent Gate to MergeWarden. The GitHub repository is
  now `sjh9714/mergewarden`, the npm package is the unscoped `mergewarden`, and
  the executable is `mergewarden`. Old repository URLs redirect; the npm scoped
  package `@jinhyuk9714/agent-gate` remains at v0.3.1 and is deprecated.
- Rename the base-branch policy file from `agent-gate.yml` to `mergewarden.yml`
  and the PR body contract marker from `agent-gate-contract` to
  `mergewarden-contract`. This is a clean break with no compatibility alias;
  see the [v0.4.0 migration guide](docs/migration-v0.4.0.md).
- Rename default report outputs to `mergewarden-report.json` and
  `mergewarden-report.md`, and environment/constant prefixes from `AGENT_GATE`
  to `MERGEWARDEN`. Finding IDs keep the `agf_` prefix so existing waivers
  remain valid.
- Entries below this point predate the rename and intentionally keep the
  original Agent Gate names.

## v0.3.1 - 2026-07-10

### Changed

- Publish the public CLI as `@jinhyuk9714/agent-gate` while preserving the
  `agent-gate` executable name.
- Update `npx`, packaging smoke, CI, and release documentation for the scoped
  package after npm rejected the unscoped name as too similar to `agentgate`.
- Keep the signed `v0.3.0` tag immutable and use a new patch release for the
  source, tarball, and provenance identity change.

## v0.3.0 - 2026-07-10

### Added

- Add public API-only PR scanning through `npx @jinhyuk9714/agent-gate scan`.
- Add a shared private GitHub collection package for the Action and CLI.
- Add file-list completeness, bounded content retrieval, retry, and rate-limit
  evidence that fails closed when analysis cannot complete.
- Add per-check GitHub Actions policy, exact expiring waivers, report
  reproducibility metadata, and narrow agentic workflow injection detection.
- Add public CLI packaging smoke tests, documentation navigation, community
  support files, and an approval-gated npm provenance workflow.

### Changed

- Make workflow dangerous-pattern findings differential against the base
  workflow instead of re-reporting unchanged conditions.
- Sanitize and bound all human report surfaces and distinguish observed,
  needs-review, blocked, and incomplete states.
- Remove severity from finding-ID fingerprints so policy tuning does not change
  the evidence identity.
- Hide the uncalibrated risk score from primary reports while retaining the
  deprecated v0.x API and Action output.
- Reposition Agent Gate as a checkout-free change-control layer for AI PRs and
  reorganize historical release documents under `docs/history/`.

### Removed

- Reject the no-op PR contract `required_evidence` field. Use deterministic
  `high_risk_paths.require_tests` policy instead.

### Security

- Never present a partial GitHub file list or unavailable required content as a
  successful analysis.
- Load policy only from the exact base SHA and preserve structured GitHub API
  errors instead of treating all failures as missing files.
- Require exact GitHub Actions bot ownership before updating a marked PR
  comment.

### Compatibility

- Existing GitHub Actions config remains accepted unless mixed with the new
  `checks` map.
- Finding IDs change once in v0.3.0 because severity is no longer part of the
  fingerprint.
- `riskScore` and `risk-score` remain deprecated through v0.x and are planned
  for removal in v1.

## v0.2.6 - 2026-06-30

### Added

- Add first-report onboarding guidance and Windows install instructions.
- Add live first-run demo PR references for README conversion.
- Add live workflow permission escalation demo evidence.
- Add opt-in PR comment demo evidence.
- Add manual copy-paste install guidance with strict pinning notes.

### Changed

- Add workflow permission escalation scope and affected-capability context to finding
  evidence and reports.
- Sharpen README top copy around checkout-free deterministic evidence.
- Reorder README onboarding around first-run install and default-policy report
  interpretation.
- Document v0.2.5 first-run smoke evidence and simplify README package
  lifecycle wording.
- Promote workflow permission escalation as the primary README proof example.

### Compatibility

- `workflow/permission-escalation` keeps the same `ruleId`, but finding IDs may
  change because v0.2.6 records richer stable evidence for permission scope and
  affected capability.

## v0.2.5 - 2026-06-26

### Added

- Add a tag-pinned observe-mode workflow template for faster first installs.
- Add package lifecycle script drift triage guidance.

## v0.2.4 - 2026-06-26

### Changed

- Add warning-mode package lifecycle script drift findings for added or changed
  `preinstall`, `install`, `postinstall`, and `prepare` scripts.

## v0.2.3 - 2026-06-26

### Changed

- Allow first-run installs without `agent-gate.yml` by falling back to the
  built-in default policy when the base-branch config is missing.
- Record default-policy fallback in report metadata as `configSource: default`.

## v0.2.2 - 2026-06-24

### Security

- Patch the transitive `undici` runtime dependency used by the committed Action
  bundle to resolve Dependabot alerts.

### Changed

- Align package versions and Agent Gate report metadata to `0.2.2`.

## v0.2.1 - 2026-06-21

### Changed

- Add evidence snapshots to findings so reports carry the stable material used
  to re-derive finding IDs.

## v0.2.0 - 2026-06-18

### Changed

- Add a version consistency test for package versions and Agent Gate version
  constants.
- Add stable finding IDs to JSON, Markdown, and compact plain-text reports as
  the foundation for v0.2 evidence-model work.
- Document the evidence model for re-derivable findings, warn-mode signal
  measurement, test-evidence limits, agent-control-plane drift boundaries, and
  future override audit concerns.

## v0.1.6 - 2026-06-17

### Changed

- Reject planned-but-unimplemented config and contract fields instead of
  accepting them as no-op settings.
- Report metadata now uses the current Agent Gate version instead of `0.0.0`.
- Surface unavailable GitHub Actions workflow content as an
  `analysis/content-unavailable` finding instead of silently skipping the
  affected workflow analysis.

## v0.1.5 - 2026-06-17

### Changed

- Add a compact plain-text Action log summary so Agent Gate decisions are
  visible in `gh run --log`.
- Runtime rule behavior and JSON decisions are unchanged.

## v0.1.4 - 2026-06-17

### Changed

- Migrate the GitHub Action runtime metadata and committed Action bundle build
  target to Node 24 to address the previous runtime deprecation warning.
- Runtime rule behavior is unchanged.

## v0.1.3 - 2026-06-16

### Security

- Pin the Action build toolchain to `esbuild@0.28.1` to address Dependabot
  security alerts in development dependencies.

## v0.1.2 - 2026-06-14

### Changed

- Markdown reports now lead with human-facing labels: `PASSED`,
  `NEEDS HUMAN DECISION`, and `BLOCKED`.
- Markdown reports now show `Why`, `Recommended Next Step`, and
  `Policy Status` before detailed findings.
- Finding-derived Markdown values are normalized and truncated for safer job
  summaries and PR comments.
- JSON decisions remain unchanged as `pass`, `warn`, and `block`.
- Runtime rule behavior is unchanged.

## v0.1.1 - 2026-06-14

### Changed

- Rename the Action metadata display name to `Agent Gate for AI PRs` for
  GitHub Marketplace uniqueness.
- Publish the GitHub Marketplace listing for the Action.

## v0.1.0 - 2026-06-14

### Added

- Deterministic core analyzer for AI-generated pull requests.
- `agent-gate.yml` config parsing.
- PR body contract parsing.
- Contract scope rules.
- High-risk path detection.
- Agent control-plane drift detection.
- Missing test evidence detection.
- GitHub Actions workflow permission escalation detection.
- Dangerous workflow pattern detection.
- CLI replay command for deterministic fixture analysis.
- Unsafe PR zoo replay fixtures.
- API-only GitHub Action wrapper.
- Root `action.yml` for `uses: sjh9714/Agent-Gate@<ref>`.
- PR report comment upsert.
- Self-dogfooding Agent Gate workflow.
- Repository CI workflow.

### Security

- The Action loads policy from the PR base branch.
- The Action does not checkout PR code.
- Runtime analysis does not call LLMs.
- Runtime analysis does not execute repository scripts.
- PR report comment API failures are non-fatal warnings.

### Known Limitations

- Comment upsert requires `issues: write` and may not work on fork PRs with
  read-only tokens.
- CODEOWNERS and reviewer evidence are not implemented yet.
- Package and dependency drift rules are not implemented yet.
- GitHub Actions job-level permission escalation comparison is limited.
- Test evidence checks only detect matching test file changes; they do not prove
  semantic coverage.
