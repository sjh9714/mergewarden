# v0.10.0

**Released 2026-08-06.**

This release exists because the documentation described a command nobody could
run.

`mergewarden triage` was merged in July, after the v0.9.0 tag, and never
published. So `npx mergewarden@0.9.0 triage` answered "Expected a command: demo,
scan, or replay" while the README's opening line told people to run exactly
that. Anyone who followed the first instruction in this project's README got an
error. That is the whole reason for the version number.

## What you can now actually run

```bash
npx --yes mergewarden@0.10.0 triage owner/repository
```

It reads a repository's open pull requests and lists only the ones with
something a maintainer normally checks by hand: no linked issue, no description,
a template left unfilled, a change past a reviewable size, an unverified author.
Rows are ordered by how many of those a pull request trips.

It needs no installation, no configuration, and no write access. It never
closes, labels, or comments, and there is no flag that does. A test asserts that
no option acts on a pull request.

Also new: `commit/ai-assistance-disclosed`, which reports the `Co-authored-by:`
trailers coding tools write about themselves. `info` by default, so it never
moves a decision.

## The documentation was rewritten

72 files and 52,219 words became 29 files and 20,243 words, with nothing
deleted. Internal memos and per-release notes moved into `docs/history/`. The
README was rebuilt for somebody who has never seen this project.

## Also fixed

CI had been failing since 2026-07-31 on two high-severity advisories published
after the last green run. Dependency overrides live in `pnpm-workspace.yaml`,
not `package.json`: pnpm 11 stopped reading `pnpm.overrides` from `package.json`
and warns rather than fails, so an override written there looks applied and is
not.

The full list is in the [changelog](../../../CHANGELOG.md).
