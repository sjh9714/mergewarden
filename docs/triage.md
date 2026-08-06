# Triage

```bash
npx --yes mergewarden triage <owner/repository>
```

Reads a repository's open pull requests and reports, for each, the facts a maintainer normally
checks by hand before spending review time.

```
8 open pull request(s) read. 7 have something a maintainer checks by hand.

#169755  feature/openAQ                      AI disclosed · no linked issue · oversized
#152200  Rejseplan_API_2_0                   AI disclosed · oversized
#176410  unifiprotect-public-only-config-m…  no linked issue · oversized
#177530  tod-support-sun-events              AI disclosed · no linked issue
#174451  feature/place-integration           no linked issue

Nothing was closed, labelled, or commented on. Run `mergewarden scan <owner/repo#number>` for
the evidence behind any row.
```

Rows are ordered by how many facts each pull request trips, so the top of the list is where a
reviewer's attention goes first. No installation, no configuration, and no write access: it
reads the same public API a browser does.

## It needs a token, including on a public repository

Set `GH_TOKEN` before running this. Reading a queue takes one request per pull request plus the
listing, and GitHub allows **60 unauthenticated requests an hour**, which a single queue uses
up. A personal access token with no scopes selected is enough, because nothing here writes.

Without one, the command says what it could not read and exits non-zero. It does not print a
queue it only half read: an unreadable pull request is a gap in the analysis, not a fact about
that pull request, and the two are counted separately for that reason.

`--limit N` reads more or fewer pull requests (default 20, maximum 100). `--format json` emits
the same data for scripting.

## What it reports

|                      |                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `no linked issue`    | The body references no issue: no `#number`, no issue URL, no closing keyword.                 |
| `no description`     | Under 80 characters of prose, counting neither template comments nor headings nor checkboxes. |
| `template unused`    | The repository ships a pull-request template and the body keeps none of its sections.         |
| `oversized`          | Past this repository's configured review size (50 files or 1,500 lines by default).           |
| `first contribution` | GitHub reports the author as `FIRST_TIME_CONTRIBUTOR` or `NONE`.                              |
| `AI disclosed`       | A commit carries a `Co-authored-by:` trailer written by a coding tool.                        |
| `agent-authored`     | The author account, branch, label or body matches a known coding agent.                       |

Boundary findings (`outside declared scope`, `agent instructions changed`,
`workflow permissions`) appear here too when the change crossed one.

`AI disclosed` reads **commit trailers only**, so a project whose disclosure convention is
something else reads as zero. starship asks every contributor to disclose AI assistance and its
pull-request template carries an `#### AI-Assistance` section that contributors fill in. None
of its open pull requests carries a trailer, and every one of those is still a disclosure. Read
this row as "disclosed in commit metadata", never as "did not disclose".

Maintenance automation is skipped: `dependabot[bot]`, `renovate[bot]` and
`github-actions[bot]` by default, configurable through `triage.exclude_authors`. Coding agents
are not skipped, because their pull requests are the ones this is for.

## A signal that fires on everything ranks nothing

If nearly every open pull request in a repository trips the same fact, that fact is the
project's norm rather than something about any one contribution. RSSHub links an issue on none
of its open pull requests; listing that on all fifteen rows would say nothing about which to
open first. It is reported once, about the repository, and dropped from the rows so the
remaining signals do the ranking:

```
15 open pull request(s) read. 2 have something a maintainer checks by hand.

Nearly every open pull request here trips "no linked issue", so it reads as this
repository's norm and is not listed per row.

#22437  feat/gov-beijing-bjhd              AI disclosed
#22836  codex/fix-zsxq-topic-id-precision  agent-authored
```

This applies at 80% and only from eight pull requests upward; below that, three of four is a
coincidence rather than a convention.

## What it does not do

**It never closes, labels, or comments.** There is no `--close` flag, and a test asserts there
is no option that acts on a pull request.

This is the difference worth stating plainly, because the alternatives make the opposite
choice. A tool that closes pull requests automatically has to be right every time, and the
public record of the leading one is its own issue tracker: a username with two consecutive
digits read as spam, a maintainer's own merge commit flagged, and no way to reopen what was
closed by mistake. A contributor whose first pull request is closed by a bot does not open a
second one.

**It reports facts, not quality.** "No linked issue" is checkable, and a maintainer can look and
disagree. "Low effort" is neither. Nothing here scores a contributor, guesses from writing
style, or infers intent; every row names the rule that produced it, and
`mergewarden scan <owner/repo#number>` prints the evidence behind it.

**It does not decide.** All of these are informational by default and none moves a pass or a
block. Raising one is a repository's choice, in
[configuration](configuration.md#commit_trailers--triage).

## Using it in CI

The same rules run in the [Action](action-reference.md). `no_linked_issue` is the one
difference: it is `off` there and on here, because most pull requests in most repositories
reference no issue, and a finding attached to nearly every report is the noise
[v0.9.0](history/releases/release-notes-v0.9.0.md) removed. Ranking many open pull requests against each other
is a different question from gating one of them.
