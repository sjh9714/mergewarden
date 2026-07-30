# Does Triage Help?

**Measured 2026-07-30 against the repositories that installed a competing tool.**

`mergewarden triage` was repositioned into a category that already had an occupant, so the
useful question is not whether the idea sounds good. It is whether the command produces a
result worth reading on the repositories that **self-identified** as having this problem.

## Who was measured

A code search for `peakoss/anti-slop` in workflow files returns **167 distinct repositories**.
Those maintainers looked at their pull request queue, decided it was a problem, and installed
something. That is the population.

**126 of them (75%) have fewer than four open pull requests.** Whatever the 740 stars on that
project measure, it is not 167 repositories with a pull-request queue. Three quarters of the
list cannot be triaged because there is nothing to rank. **41** have real volume.

## What counts as helping

Decided before running, and written so that both extremes fail:

| Verdict    | Condition                                                                                   |                                                          |
| ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **ranked** | some pull requests flagged, and either fewer than 80% or at least one carries several facts | the list is ordered, which is the point                  |
| **silent** | nothing flagged                                                                             | correct, and useless to the reader                       |
| **flat**   | 80% or more flagged, none with more than one fact                                           | ranks nothing — the failure this command exists to avoid |

## Result

Of the 34 repositories that could be judged (six hit GitHub's secondary rate limit, one dropped
below the floor):

|          |              |
| -------- | -----------: |
| ranked   | **20 (59%)** |
| silent   |     14 (41%) |
| **flat** |        **0** |

Restricted to the 13 with 100 stars or more, **11 of 13 are ranked** — including
`huggingface/transformers` (8 of 10), `coollabsio/coolify` (6 of 10) and
`typescript-eslint/typescript-eslint` (4 of 10).

**No repository came back flat.** That is the result worth having, because the first run of this
measurement did produce one: `DIYgod/RSSHub` returned 15 of 15, almost all "no linked issue",
because that project links an issue on nothing. Fifteen identical rows rank nothing. Lifting a
note carried by 80% of a repository's pull requests out of the rows fixed it, and nothing in the
sample reproduced it afterwards.

**41% silence is the honest problem.** For the Action, saying nothing is correct behaviour. For
someone typing `npx mergewarden triage` at their own repository once, two in five see an empty
result — and that first run is the only distribution this command has.

## What the measurement caught about the tool

Running against real repositories found five defects in one day. Four were invisible inside this
repository:

1. Maintenance automation reported for not following the template — starship's own release bot.
2. Template headings counted from inside HTML comments, flagging 10 of 12 Next.js pull requests.
3. A note carried by every pull request repeated on every row (RSSHub).
4. **The JSON and human views disagreed.** The uniform-note fix ran after the JSON branch
   returned, so the first pass of _this_ measurement scored the behaviour the fix had already
   removed. Those numbers were discarded and the run repeated. A test now pins the ordering.
5. No backoff on the pull-request listing. GitHub answers a burst with `403` under its secondary
   rate limit, and 16 of 41 repositories failed that way before a bounded retry was added.

## Limits

- **Ten pull requests per repository.** The command's default is twenty; a wider read would flag
  more, so the silent share is an upper bound rather than a fixed rate.
- **Adopting one tool is not the same as having the problem**, and the 75% with no queue suggests
  a good part of the list installed it speculatively.
- **Six repositories are missing** from the final count, lost to rate limiting rather than to
  anything about them.
- This measures whether the output _discriminates_, not whether a maintainer found it useful.
  Only a maintainer can answer that, and none has yet.

Reproduce the population with a code search for `peakoss/anti-slop path:.github/workflows`, then
`mergewarden triage <owner/repo> --format json` per repository.
