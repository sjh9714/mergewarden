# MergeWarden v0.9.0 Release Notes

[v0.6.0](release-notes-v0.6.0.md) stopped MergeWarden from blocking a pull
request over a convention nobody has adopted. This release stops it from
nagging about one. Same principle, one step further: **speak about what a pull
request did, not about what it did not declare.**

## Why

Installing the tool and then reading what it says every day are different
experiences, and only the first one was ever measured here. The second one
looked like this: every routine agent pull request — in scope, nothing
dangerous — produced `contract/missing` at `warn`, which resolved the whole
pull request to `NEEDS REVIEW`. Nothing was wrong with those pull requests. The
scan study measured **0 of 2,204** merged agent pull requests declaring a scope,
so the rule fires on essentially all of them, essentially always.

A signal that fires on everything is not a signal. Within a week a maintainer
learns to skip it, and `workflow/permission-escalation` and
`agent-control-plane/drift` — the findings this project exists to surface — get
skipped along with it.

## `contract/missing` now defaults to `info`

```yaml
contract:
  missing_severity: info # or: warn, error
```

`info` findings are recorded in the report and do not affect the decision. A
routine agent pull request now reports `agent/origin-detected` and
`contract/missing`, both informational, and resolves to **`pass`**.

The escalation path is unchanged and still one line: raise it to `warn` once you
have asked contributors to declare scope, and to `error` once they do.
`contract/invalid`, `contract/out-of-scope` and `contract/blocked-path` stay
`error` — each fires on something a pull request did against its own declaration.

`allow_missing_in_observe_mode` is now a **no-op**. It downgraded
`contract/missing` to `warn` in observe mode, which made sense against an
`error` default; against an `info` default the same code would _raise_ the
severity a repository had deliberately configured. The key is still accepted so
existing configuration keeps parsing.

## The Action comments only when there is something to say

`comment` now takes `auto`, `always`, or `never`. `true` and `false` keep
working and mean `always` and `never`.

| Value    | Behaviour                                                        |
| -------- | ---------------------------------------------------------------- |
| `never`  | Never touches the pull request. Still the default.               |
| `auto`   | Comments only on an error, a warning, or an incomplete analysis. |
| `always` | Comments on every run, including a clean pass.                   |

Before this release the Action posted on **every** run it was enabled for,
including a passing one — a `PASSED` comment on every pull request, forever.

`auto` also resolves what it posted: if a run commented and a later run passes,
the existing comment is **updated** to the passing report rather than deleted,
so a stale `NEEDS REVIEW` cannot outlive the problem it described.

The default stays `never`, because the install documented in the README grants
`pull-requests: read` and commenting needs `write`. The README now recommends
`comment: auto` with `pull-requests: write`, which is the configuration worth
having. Note that pull requests from forks receive a read-only token on the
`pull_request` event regardless of what the workflow requests.

## Also

[`docs/start-here.md`](start-here.md) is a new one-page introduction: install,
what the first pull request will look like, and one line explaining each
finding. This project has 38 documents and no front door.

## Breaking

No API breaks. Two default behaviours change:

- An agent pull request whose only issue is a missing contract now resolves to
  `pass` instead of `needs-review`. Set `contract.missing_severity: warn` to
  restore the previous behaviour.
- `allow_missing_in_observe_mode` no longer changes anything. If you set
  `missing_severity: error` and relied on observe mode softening it, the
  reported severity is now `error` there too. The observe-mode decision is
  `pass` either way, so no gate changes.

## Upgrading

```yaml
- uses: sjh9714/mergewarden@v0.9.0
```

No configuration change required.
