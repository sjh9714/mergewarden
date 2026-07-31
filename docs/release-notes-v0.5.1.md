# MergeWarden v0.5.1 Release Notes

v0.5.0 shipped working agent-detection defaults. One of them did not work.

Claude Code appends this footer to a pull request body:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

The product name sits inside a Markdown link. Body markers are matched as
case-insensitive substrings, so the default `Generated with Claude Code` could
never match a real body — the substring is not there. It came from the scan
study's _search query_, and GitHub's search index tokenises, so the query finds
these pull requests even though a literal match does not.

Measured against 13 real Claude Code pull requests from the study corpus:

| Marker                                          | Matches      |
| ----------------------------------------------- | ------------ |
| `Generated with Claude Code` (v0.5.0 default)   | **0 of 13**  |
| `Generated with [Claude Code]` (v0.5.1 default) | **12 of 13** |

The one miss had its footer edited out before merge. Nothing can detect that
from the artifact, and the documentation does not claim otherwise.

## Why this marker carries more weight than the others

Codex, Cursor, Copilot and Devin open pull requests from their own bot accounts
or branch prefixes, so `authors` and `branch_patterns` catch them. Claude Code
usually runs on a developer's own machine and pushes to an ordinary branch name.
For that cohort the body footer is frequently the only signal available — which
is why a marker that matched nothing mattered.

## Upgrading

```yaml
- uses: sjh9714/mergewarden@v0.5.1
```

No configuration change is required. A repository that sets `body_patterns`
explicitly is unaffected, since an explicit setting replaces the default.

If you set it explicitly and copied the old value, change it:

```yaml
agent_detection:
  body_patterns: ["Generated with [Claude Code]"]
```

## Also in this release

The scan study's methodology now states which of its rates carry across engine
versions and which do not. The per-rule boundary rates — 3.9% control-plane
drift, 12.9% permission escalation, 17.5% unpinned references, 22.1% dangerous
patterns — are unaffected by v0.5.0's detection fix, verified by re-scanning a
66-pull-request stratified sample of the dataset under the new defaults and
getting identical boundary findings on 66 of 66.

The "at least one finding" rate does not carry across. With detection inert in
v0.4.0, the study's 7.0% is precisely a boundary-crossing rate. Re-running that
corpus on v0.5.0 or later would add `contract/missing` to nearly all of it —
0 of 2,204 declared a contract — producing a headline near 100%, which measures
disclosure adoption rather than boundary crossings. The README and the long-form
article now say "boundary-crossing rate" where they previously said "finding
rate".
