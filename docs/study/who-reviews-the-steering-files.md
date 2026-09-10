# Who Reviews the Steering Files?

**Measured 2026-08-11.**

The README opens with a claim: a pull request that edits `CLAUDE.md` reads like
a documentation tidy-up, and the change "shows up in nothing anyone reviews
afterwards". That sentence had never been measured. This page measures the
closest checkable angle: when an agent pull request changes an instruction file
and gets merged, did any human say anything about that file first?

## The answer

**One of 82 readable PRs had a human inline comment on an instruction file.
That PR added the file. This does not establish which files were read.**

Out of the 2,204 merged agent-authored pull requests in the
[scan study](what-2204-agent-prs-showed.md), 86 carried an
`agent-control-plane/drift` finding. 82 could still be read; 4 now return 404.

| Cohort                        | PRs | Any human review | Human inline comment on the instruction file |
| ----------------------------- | --: | ---------------: | -------------------------------------------: |
| Instruction file **added**    |  14 |                3 |                                        **1** |
| Instruction file **modified** |  68 |               12 |                                        **0** |

The one pull request where humans commented on the file itself,
[`dbeaver/dbeaver#41333`](https://github.com/dbeaver/dbeaver/pull/41333), is the
pull request that **introduced** `AGENTS.md` to the repository. Twelve inline
comments, including a maintainer pushing back line by line: "I don't think we
should write about that." That is what review of a steering file looks like, and
in this sample it happened exactly once, at creation.

None of the 68 modifying pull requests received a human inline comment on the
instruction file. A review without such a comment is not evidence of neglect.

## It is not that nobody reviews these pull requests

The obvious objection is that most of these are personal repositories where the
author merges their own agent's work, so of course nobody commented. That is
true for most of the sample, and it is why the split below matters.

Restricted to repositories with 100 or more stars, where somebody other than
the author is plausibly watching, and to pull requests that **modified** an
existing instruction file:

- 17 pull requests, including `apache/echarts`, `AvaloniaUI/Avalonia`,
  `bytedance/deer-flow`, `super-productivity/super-productivity`
- **10 of 17 received a formal human review**
- **0 of 17 received a human comment on the instruction file itself**

These PRs received formal reviews, but no inline comment was anchored to the
instruction file. The data cannot distinguish a file that was ignored from one
that was reviewed and accepted without comment.

## What this does and does not support

The old README claimed a visibility gap after merge. This measurement covers
review comments before merge, not post-merge visibility or reviewer attention.
It therefore does not validate that claim or establish demand for a separate
instruction-file alert. Those would require direct maintainer evidence.

## Limits

- **A missing comment does not prove nobody read the file.** A reviewer may have
  read the instruction-file diff and found it fine. This measures whether anyone
  said anything, which is the only observable trace.
- **Text-mention matching over-counts, so it is excluded from the headline.**
  One repository matched on conversation comments containing file names, and
  reading it showed a human pasting agent prompts that happened to contain the
  paths, not a review
  ([`Aries-Serpent/_codex_#5365`](https://github.com/Aries-Serpent/_codex_/pull/5365)).
  The headline counts inline review comments anchored to the file, which cannot
  false-positive this way.
- **4 of 86 pull requests could not be read** (repository deleted or made
  private) and are excluded, not counted as silent.
- The cohort is agent-authored pull requests that were **merged**. A pull
  request rejected because a reviewer caught an instruction-file change never
  enters it, so this cannot measure how often review prevents the change. It
  measures what reaches permanent history.
- Snapshot of one scan window (July 2026); queues and review habits move.

## Reproduce

`tools/study/instruction-file-reviews.mjs` reads the scan study's
`results.jsonl`, extracts every pull request whose report carries an
`agent-control-plane/drift` finding, and for each one fetches reviews, inline
review comments, issue comments, and per-file add/modify status through the
GitHub REST API. Signals are counted separately and never summed. Output lands
in `tools/study/data/instruction-file-reviews.jsonl`.

One implementation note that is also a warning: `gh api` switches from GET to
POST when `-F` parameters are present. The first run of this script therefore
created an empty pending review draft on every pull request in the cohort
instead of reading anything. Pending reviews are invisible to everyone but
their author and all 82 were deleted the same hour, but the script now routes
every call through a GET-only wrapper so a measurement tool cannot write.
