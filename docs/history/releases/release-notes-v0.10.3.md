# v0.10.3

**Released 2026-08-06.**

A documentation release. No behaviour changed.

## Why it needed a version number

npm packages are immutable, and the GitHub Marketplace listing reads its
description from `action.yml` at the released tag. Both were still describing
the project as it was two months ago, and neither could be corrected without
publishing again.

## The npm page

`npmjs.com/package/mergewarden` renders `packages/cli/README.md`, which was
worse than out of date:

- it told people to run `npx mergewarden@0.8.0`, two releases behind
- it never mentioned `triage`, which is the reason 0.10.x exists
- it said "Authentication is optional for public repositories", which is false
  for `triage`, since 60 unauthenticated requests an hour does not cover one
  queue

Rewritten. Exit codes are now given per command, because they differ: `scan` and
`replay` return `2` on an incomplete analysis, while `triage` returns `1`, since
a partly-read queue is still worth printing.

## The Marketplace listing

Its description came from `action.yml`, which still read "Checkout-free policy
gate for AI-generated pull requests". It now describes the check the README
leads with.

The action's `name` is deliberately unchanged. The Marketplace slug is derived
from it, so renaming would orphan the existing listing URL for no gain.

## Also

`docs/roadmap.md` stopped at "Shipped in v0.3.1" while the project was on
v0.10.2. Seven releases were invisible.

The older version strings in `docs/demo-prs.md` are unchanged on purpose: they
record which build produced which verified external run.

The full list is in the [changelog](../../../CHANGELOG.md).
