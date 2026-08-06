# v0.10.2

**Released 2026-08-06.**

A bug fix for the command this project tells people to run first.

## What was wrong

Run against a public repository with no token, `triage` printed this:

```
20 open pull request(s) read. 14 have something a maintainer checks by hand.

#10586  gci-fun-1                    could not be read
#12046  feat/detect-nested-any-in-…  could not be read
#12086  strict-void-return-fixer     could not be read
...
```

With a token the same repository returns five rows. Nine of those fourteen were
not pull requests needing attention. They were GitHub refusing the request:
60 unauthenticated calls an hour, which one queue uses up.

Every failure became a note in the same shape a finding has, so the tool's own
broken state was counted as the repository's problem, sorted among real
findings, and the process exited `0`.

## What it does now

Unreadable pull requests are counted separately, reported on their own line, and
the run exits non-zero:

```
9 open pull request(s) read. 3 have something a maintainer checks by hand.
11 could not be read, so this is a partial answer. GitHub allows 60
unauthenticated requests an hour, which one repository's queue exhausts.
Set GH_TOKEN to a personal access token and run it again.
```

An exhausted quota stops the run rather than attempting every remaining pull
request, and the hourly quota is no longer retried: that backoff spent two
minutes on a wait that could not have helped.

## Why it shipped in the first place

`runTriageCli` was never executed by the test suite. Every triage test was a
pure function or an assertion about the source text, so all 90 passed while the
command's error handling was wrong. There is now an integration test that runs
it against stubbed GitHub calls, and five of its cases fail against the previous
code.

## Documentation

The README leads with the one check nothing else appears to make: a pull request
that edits the files coding agents read as instructions. It was verified against
a real run before the copy was written.

Install drops from four options to one. Three of them were doing nothing.

The full list is in the [changelog](../../../CHANGELOG.md).
