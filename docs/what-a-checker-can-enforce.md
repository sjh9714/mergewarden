# What a Checker Can Actually Enforce

Most AI-contribution policies cannot be enforced by any tool. That is not a
criticism of the policies, and it is the single most important thing to
understand before wiring MergeWarden — or anything else — into a review process.

This page maps real policy clauses to what a deterministic checker can decide,
and says plainly which of them MergeWarden covers and which it does not.

## Where the clauses come from

The clause survey behind this page reads the policies collected in
[ecogetaway/oss-ai-contribution-policy](https://github.com/ecogetaway/oss-ai-contribution-policy)
— curl, Fedora, Gentoo, Ghostty, Godot, Kubernetes, llama.cpp, LLVM, Mesa,
NetBSD, OpenStreetMap, QEMU, Rust (proposed), servo, tldraw, Asahi Linux, Bevy,
Home Assistant, FreeBSD, Zig. That catalogue is other people's work; this page
is our reading of it.

## Three kinds of clause

**Enforceable today.** Decidable from what a forge already exposes: PR author
and account type, title, body, labels, branch, commit messages and trailers, the
diff, and repository files. No new contributor behaviour required.

**Needs a per-PR signal.** Mechanically decidable, but only once the pull
request declares something first. The rule is not vague; the input is missing.

**Unenforceable in principle.** Depends on intent, comprehension, provenance, or
the truthfulness of a self-report. No artifact exposes it.

Roughly half the clauses in that corpus fall in the third bucket, and **every
flat "no AI-generated contributions" ban does** — establishing that a change was
model-produced is not something any checker can do. Anything claiming otherwise
is guessing.

## The map

| Policy clause                                               | Kind              | MergeWarden                                                                                                                    |
| ----------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Use an `Assisted-by:` / `Generated-by:` trailer to disclose | Enforceable       | [`commit/trailer-missing`](rules/commit-trailers.md)                                                                           |
| Never list an AI tool as `Co-authored-by:`                  | Enforceable       | [`commit/trailer-forbidden`](rules/commit-trailers.md)                                                                         |
| Every commit carries a DCO `Signed-off-by:`                 | Enforceable       | [`commit/trailer-missing`](rules/commit-trailers.md) with `applies_to: all`                                                    |
| Changes to agent instruction files need human eyes          | Enforceable       | `agent-control-plane/drift`                                                                                                    |
| Do not escalate workflow permissions                        | Enforceable       | `workflow/permission-escalation`                                                                                               |
| Pin actions, reusable workflows, and containers             | Enforceable       | `workflow/dangerous-pattern`                                                                                                   |
| Do not add install-time lifecycle scripts unreviewed        | Enforceable       | `dependency/lifecycle-script-added`                                                                                            |
| Untrusted PR text must not reach an agent prompt            | Enforceable       | [`workflow/agentic-untrusted-input`](rules/agentic-workflow-injection.md)                                                      |
| Stay within the scope you declared                          | Needs a signal    | `contract/out-of-scope` — the [PR contract](configuration.md#agent-detection-and-contracts) _is_ that signal                   |
| Disclose AI use (no format specified)                       | Needs a signal    | Only once the project picks a format; a trailer is the one MergeWarden reads                                                   |
| High-risk paths need accompanying test changes              | Needs a signal    | `evidence/missing-test-change`, once `high_risk_paths` declares them                                                           |
| No autonomous agents                                        | Partly            | `agent/origin-detected` flags known agent authors, branches and labels; a self-hosted agent that looks human is not detectable |
| Reserve newcomer issues for humans                          | Not covered       | The label is observable; MergeWarden does not read linked issues                                                               |
| First-time contributors need a maintainer vouch             | Not covered       | Observable in principle; not implemented                                                                                       |
| No AI-generated contributions, at all                       | **Unenforceable** | Not attempted                                                                                                                  |
| You must understand every line you submit                   | **Unenforceable** | Not attempted                                                                                                                  |
| Do not use AI to write PR descriptions or review replies    | **Unenforceable** | Not attempted                                                                                                                  |
| Do not use PR interactions to train models                  | **Unenforceable** | Not attempted                                                                                                                  |

## What this means in practice

**The enforceable half is mostly not about AI.** Scope declarations, permission
diffs, path protection, trailer conventions, account checks — none of them
require deciding whether a model was involved. That is why MergeWarden never
asks. A finding says a boundary was crossed, not who or what crossed it.

**Disclosure only becomes checkable when it has a shape.** "Tell us you used AI"
in prose gets you a sentence a human must read. The same requirement expressed
as a commit trailer is a CI gate. Projects that prescribe a format — Fedora,
Mesa, LLVM, Kubernetes, QEMU, FreeBSD — get enforcement for free; projects that
do not, do not. If you are writing a policy, this is the cheapest decision you
can get right.

**A declared scope is the missing primitive.** Of 2,204 merged agent pull
requests we [scanned](study/methodology.md), zero declared, in any
machine-checkable form, what they intended to change. Nobody had asked them to —
which is exactly why "did this PR stay in bounds?" is a question no tool could
answer. The [PR contract](configuration.md#agent-detection-and-contracts) is one
concrete proposal for where that declaration could live.

**Aspirational clauses are still worth writing.** "You must understand your own
change" belongs in a policy even though nothing can verify it. The mistake is
believing a tool has checked it. Keep the two kinds of clause visibly apart, in
the policy and in the review process built on top of it.

## Related

- [Configuration reference](configuration.md) — how to declare each of the
  enforceable checks.
- [Commit trailer rules](rules/commit-trailers.md) — the newest of them, and
  what a present trailer does and does not prove.
- [Security model](security-model.md) — what MergeWarden reads and never
  executes.
- [The 2,204-PR study](study/methodology.md) — where the scope-declaration
  number comes from.
