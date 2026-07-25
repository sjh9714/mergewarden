# MergeWarden v0.4.1 Release Notes

MergeWarden v0.4.1 adds commit trailer rules and makes the pull request comment
short enough to live with. Both changes came from reading and using the thing:
one from surveying the AI-contribution policies MergeWarden is meant to enforce,
the other from the first outside maintainer who tried the Action and said the
bot comment was too long.

No policy behaviour changes for an existing repository until it opts in.

## Try It

```bash
npx --yes mergewarden@0.4.1 scan owner/repo#123
```

## Highlights

**Commit trailer rules.** `commit/trailer-missing` and `commit/trailer-forbidden`,
configured under a new `commit_trailers` key. Real AI-contribution policies
express disclosure as a commit trailer and disagree on which one — Fedora and
Mesa require `Assisted-by:`, Kubernetes forbids it, QEMU and FreeBSD require a
DCO `Signed-off-by:` — and every one of those clauses is decidable from commit
metadata alone, with no heuristics and no model. See
[the rule guide](rules/commit-trailers.md).

```yaml
commit_trailers:
  required:
    - any_of: [Assisted-by, Generated-by]
      applies_to: agent # agent | all — `all` is what a DCO rule needs
      severity: warn
  forbidden:
    - name: Co-authored-by
      value_patterns: ["*claude*", "*copilot*"]
      severity: error
```

Both lists default to empty, so nothing changes until you add an entry.

**A pull request comment you can read.** The detailed findings now sit behind a
`<details>` fold in the PR comment. A 12-finding report goes from 371 rendered
lines to 33 before the fold — decision, why, recommended next step, counts. The
findings, evidence snapshots, finding IDs and remediation are all still there,
one click away; report files, job summaries and the CLI are unchanged.

**A new documentation page,** [what a checker can actually enforce](what-a-checker-can-enforce.md),
mapping real policy clauses to what is decidable — including the clauses
MergeWarden does not and will not attempt, such as deciding whether a change was
model-produced.

## Compatibility

- **The default policy digest changed** because the configuration schema gained
  the `commit_trailers` key. Digests recorded against v0.4.0 will differ. No
  finding IDs changed, so existing waivers remain valid.
- The GitHub collector now enumerates pull-request commits. GitHub caps that
  listing at 250; when MergeWarden cannot collect all of them it omits commits
  entirely and the trailer rules stay inert, rather than run against a partial
  list that could only under-report. The CLI and Action print a warning.
- The trust boundary is unchanged: one additional read-only API call, no
  checkout, no execution of pull-request code, no head-branch policy loading,
  no LLM.

See the [changelog](../CHANGELOG.md), [CLI reference](cli.md), and
[release checklist](release-checklist.md).
