# Security Model

MergeWarden inspects pull-request metadata and changed-file content without
executing PR-controlled code.

## Trusted Inputs

- Built-in policy bundled with the pinned MergeWarden ref.
- `mergewarden.yml` from the exact base commit.
- Action code from the selected release tag or commit SHA.
- GitHub REST responses, subject to explicit completeness checks.

## Untrusted Inputs

- PR title, body, author claims, labels, and branch name.
- PR-body contract and all changed paths/content.
- Head-branch policy files and workflow YAML.
- Finding text derived from paths, jobs, expressions, or evidence.
- Agent instructions, MCP configuration, and other control-plane files.

## Runtime Guarantees

- No checkout or execution of target PR code.
- No dependency installation from the target repository.
- No runtime LLM or MCP-server calls.
- No evaluation of GitHub expressions found in workflow YAML.
- API-only collection with bounded concurrency, retries, content, findings,
  and report rendering.
- Policy is never loaded from the PR head.

## Collection Integrity

MergeWarden fetches the authoritative PR file count and compares it with pages
from GitHub's files endpoint. More than 3,000 files or any count mismatch fails
closed as `analysis/file-list-incomplete` without running partial policy rules.

Only policy-relevant workflow and package files are fetched. Added files need
head content; modified/renamed files use base and head; fork head content comes
from the fork repository and exact head SHA. Decoded content is limited to 1
MiB per file side and 64 MiB for the run. Confirmed 404 is distinct from
authentication, rate-limit, and server errors.

Required content failures, oversized text, and report-limit overflow are
integrity failures, not ordinary warnings.

## Reports and Comments

All PR-derived values are normalized, escaped, mention-neutralized, bounded,
and rendered as data rather than raw Markdown. PR comments are updated only
when both the hidden managed marker and exact GitHub Actions bot ownership
match. Managed-comment discovery reads only the newest 100 comments.

Comments and summaries are bounded mirrors. JSON metadata and finding IDs are
the deterministic audit material; mutable comments are not the sole record.

## Base-Policy Waivers

Waivers are exact finding-ID entries with reason and expiry in base policy.
PR-head waivers are ignored. Analysis-integrity findings cannot be waived.

## Known Limitations

- No semantic correctness proof or general vulnerability scan.
- No CODEOWNERS/reviewer policy yet.
- Test evidence checks changed paths, not test meaning or execution.
- Agentic workflow injection follows registered prompt inputs and one `env`
  hop only; it is not complete taint analysis.
- Comment writes depend on token permissions and may be unavailable on forks.
- GitHub API availability remains an external dependency; failures are exposed.

## Self-Dogfooding

This repository uses the package-local Action from `main` without checkout so a
PR cannot execute its modified Action bundle. Ordinary CI may checkout this
repository and run its own trusted package scripts.
