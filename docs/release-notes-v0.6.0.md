# MergeWarden v0.6.0 Release Notes

v0.5.0 made agent detection work for the first time. This release fixes what
that exposed: with detection live, `contract/missing` fires on nearly every
agent pull request — and it was hardcoded to `error`.

## Why that was wrong

`error` blocks. This project's own [adoption path](../README.md#adopt-safely)
tells teams to graduate to `mode: block` at step 4. Doing that would have
rejected **every agent pull request**, because no coding agent emits a scope
contract by default — the scan study measured **0 of 2,204**. There is nothing a
reviewer can do about it by reviewing the change.

It also ranked a missing declaration exactly as severe as
`workflow/permission-escalation`, which fires when a workflow actually moves from
`contents: read` to `contents: write` plus `id-token: write`. One is the absence
of a convention almost nobody has adopted; the other is a privilege boundary
moving. Treating them identically flattens the signal the tool exists to provide.

## The change

`contract/missing` now defaults to `warn`, and its severity is configurable:

```yaml
contract:
  missing_severity: warn # or: error
```

`contract` was the only rule family without severity control — every other one
already had it — so this closes an inconsistency rather than adding a special
case.

Verified against real agent pull requests on `mode: block`:

| Pull request                                               | Before | After     |
| ---------------------------------------------------------- | ------ | --------- |
| Agent PR, no contract, nothing dangerous                   | block  | **warn**  |
| Agent PR, no contract, **edits an agent instruction file** | block  | **block** |

The tool now blocks on what a pull request did, not on a convention it did not
follow.

`contract/invalid`, `contract/out-of-scope` and `contract/blocked-path` remain
`error`. Each fires on something a pull request did against its own declaration,
which is the check this project leads with.

## Breaking

No API breaks, but the default decision changes in one case, which is why this
is a minor bump:

- On `mode: block`, an agent pull request whose only issue is a missing contract
  no longer blocks. Set `contract.missing_severity: error` to restore it.
- On the default `mode: warn`, the decision is unchanged — `needs-review` before
  and after. Only the reported severity changes from error to warning.

## Also fixed

Three user-facing strings said "an mergewarden contract", left over from the
v0.4.0 rename. Now that detection works, `contract/missing` is the most
frequently emitted finding in the ruleset, so that was the sentence most new
installs would read first.

## Upgrading

```yaml
- uses: sjh9714/mergewarden@v0.6.0
```

No configuration change required.
