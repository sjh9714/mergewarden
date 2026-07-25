# Commit Trailers

Projects that publish an AI-contribution policy overwhelmingly express the
disclosure part of it as a **commit trailer** — and they do not agree on which
one, or even on its direction. Fedora asks contributors to add
`Assisted-by: <tool>`. Mesa requires `Assisted-by:` or `Generated-by:` and
reserves `Co-authored-by:` for humans. LLVM suggests `Assisted-by:`. Kubernetes
forbids `assisted-by`, `co-developed`, and listing an AI tool as a co-author.
QEMU and FreeBSD require a DCO `Signed-off-by:` on every commit.

Every one of those clauses is decidable from commit metadata alone — no
checkout, no heuristics, no model. These rules make them checkable.

## What The Findings Mean

`commit/trailer-missing` means a commit in the pull request does not carry any
of the trailers a `required` entry lists. MergeWarden records the commit, the
trailers it expected, the trailers that were actually present, and the commit
subject.

`commit/trailer-forbidden` means a commit carries a trailer the repository
declared unacceptable. When the entry sets `value_patterns`, only trailers whose
value matches one of the patterns are reported, and the matching pattern is
recorded as evidence.

Trailer names are matched case-insensitively, as Git itself does.

## Configuration

```yaml
commit_trailers:
  enabled: true
  required:
    - any_of: [Assisted-by, Generated-by]
      applies_to: agent # agent | all
      severity: warn
  forbidden:
    - name: Co-authored-by
      value_patterns: ["*claude*", "*copilot*"]
      severity: error
```

`required` entries are satisfied when a commit carries **any** of the listed
trailers, which is how a project supports more than one disclosure tier without
demanding a specific one.

`applies_to: agent` evaluates the entry only when
[agent detection](../configuration.md#agent-detection-and-contracts) fires for
the pull request; `applies_to: all` evaluates it on every pull request, which is
what a DCO requirement needs.

`forbidden` entries without `value_patterns` reject the trailer outright.
With `value_patterns`, only matching values are rejected — that is the
difference between "we do not use this trailer" and "humans only." Patterns are
case-insensitive and `*` is the only wildcard.

Both lists default to empty, so upgrading does not change any existing
repository's decisions until an entry is added.

## How Trailers Are Parsed

MergeWarden follows Git's own definition: trailers live in the **final paragraph**
of the commit message, and that paragraph counts as a trailer block only when
every non-blank line in it is a `Key: value` pair or an indented continuation of
one. A commit whose closing paragraph is ordinary prose therefore yields no
trailers, which is what keeps a sentence like `Fixed by: rewriting the loop` out
of the results. A single-paragraph commit message has no trailer block at all —
the subject line is never a trailer, even when it contains a colon.

## Limits Worth Knowing

**These rules stay inert when MergeWarden could not enumerate every commit.**
GitHub caps pull-request commit listing at 250 entries. When a pull request
exceeds that, or when the collected count does not match what GitHub reported,
MergeWarden omits commits entirely rather than run trailer checks against a
partial list — a partial list can only under-report, and a silent under-report
is worse than a visible absence. The CLI and Action print a warning when this
happens.

**A present trailer is a claim, not a verified fact.** `Assisted-by: Codex` is
checkable in the sense that MergeWarden can confirm the contributor stated it.
Whether the statement is true is not decidable from the pull request, and this
rule does not pretend otherwise. That boundary is the point: the rule enforces
the part of a disclosure policy that a machine can actually enforce, and leaves
the rest to review.

**This is not AI detection.** Nothing here infers whether a model wrote the
change. It reads what the commit says about itself.

## What To Check

- Does the missing trailer reflect an undisclosed tool, or a contributor who did
  not know the convention? The second is a docs problem, not a policy violation.
- For a forbidden co-author, is the listed identity a tool or a person? Value
  patterns are a blunt instrument and will need tuning per project.
- If the finding fires on every commit of an otherwise good pull request, the
  requirement is probably scoped too broadly — consider `applies_to: agent`.

## Remediation

Trailers live in the commit message, so fixing a finding means amending the
commit and force-pushing the branch. For a long-running branch, squashing before
merge is usually less disruptive than rewriting each commit.
