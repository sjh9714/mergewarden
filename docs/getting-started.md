# Getting Started

Everything you need for the first week: how to install it, what the first report
means, and how to tighten it once you trust it.

## Look before you install

You can run MergeWarden against any public pull request without installing
anything and without a token:

```bash
npx --yes mergewarden@0.10.0 scan owner/repository#123
```

Try it on a pull request you already know well. If the report tells you nothing
you did not already know, it is doing its job, because most pull requests cross
no boundary at all.

To look at a whole repository rather than one pull request, `triage` reads every
open pull request and lists only the ones with something a maintainer checks by
hand:

```bash
npx --yes mergewarden@0.10.0 triage owner/repository
```

It needs no write access and writes nothing back. [Triage](triage.md) explains
what each row means and where the thresholds come from.

Set `GH_TOKEN` for private repositories or for a higher API rate limit. There is
no command-line flag for the token, deliberately, because flags end up in shell
history and CI logs. The [CLI reference](cli.md) covers the other output
formats.

## Install it

Create `.github/workflows/mergewarden.yml`:

```yaml
name: MergeWarden

on:
  pull_request:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled, ready_for_review]

permissions:
  contents: read
  pull-requests: write

jobs:
  mergewarden:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/mergewarden@v0.10.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
          comment: auto
```

There is no checkout step and no config file to write. MergeWarden reads the
pull request through the GitHub API, and until you add a `mergewarden.yml` of
your own it uses a built-in default policy.

`mode: warn` with `fail-on-block: false` means nothing is ever blocked from
merging. Leave it that way for a while.

## What the first pull request looks like

Most agent pull requests cross no boundary. Those pass, and with `comment: auto`
MergeWarden says nothing at all: the details go to the Actions job summary
instead. You get a comment when there is a warning, an error, or an analysis it
could not finish.

Push a fix and that same comment rewrites itself to `PASSED` rather than being
deleted, so a stale review request cannot outlive the problem it described.

Pull requests from forks get a read-only token from GitHub, so they are never
commented on.

## Reading a report

Every report ends with one of five verdicts:

| Verdict               | What it means                                                            |
| --------------------- | ------------------------------------------------------------------------ |
| `PASSED`              | Analysis finished and nothing active needs your attention.               |
| `OBSERVED FINDINGS`   | Evidence was recorded, but observe mode left the decision alone.         |
| `NEEDS REVIEW`        | Warn mode found something a person should decide about.                  |
| `BLOCKED`             | Block mode rejected the change.                                          |
| `ANALYSIS INCOMPLETE` | Something could not be read, so no verdict is claimed and the run fails. |

That last one matters. MergeWarden would rather fail than tell you a pull
request passed when it could not see all of it.

When you read a report, work down it in this order:

1. Check that analysis is complete and the expected and analyzed file counts agree.
2. Check where the policy came from (see below).
3. Read the highest-severity finding and what it suggests doing.
4. Quote the finding ID when you discuss or dismiss that exact piece of evidence.
5. Look at waived findings separately. They stay in the record.

### Where the policy came from

Each report says which of these applied:

- `base-branch`: your config, read from the exact base commit.
- `default`: the config path returned a confirmed 404, so the built-in policy ran.
- `local`: the report came from replay fixtures.

Only a confirmed 404 selects the default. Authentication failures, rate limits,
server errors, and malformed responses never fall back quietly, because a silent
fallback would look identical to a passing repository.

## What each finding is telling you

| Finding                            | What it means                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `agent/origin-detected`            | This pull request looks agent-authored. Context, not a problem.                               |
| `contract/missing`                 | The body declared no intended scope. Informational by default.                                |
| `contract/out-of-scope`            | A file changed outside the scope the pull request itself declared.                            |
| `agent-control-plane/drift`        | `AGENTS.md`, `CLAUDE.md`, `.mcp.json` or similar changed. These steer every future agent run. |
| `workflow/permission-escalation`   | A workflow gained permissions it did not have on the base branch.                             |
| `workflow/agentic-untrusted-input` | Pull-request text now flows into an agent prompt.                                             |
| `dependency/*`                     | An install-time lifecycle script was added or changed.                                        |
| `analysis/*`                       | Something could not be read. Treat the result as inconclusive.                                |

The first two are what you will see most, and neither changes the decision. Only
warnings and errors do.

## Tightening it up

Once you have watched it for a while and agree with what it says:

1. Raise individual checks from `warn` to `error`. Prefer per-check severity
   over switching whole rule families off.
2. Set `mode: block`.
3. Set `fail-on-block: true`.
4. Require the MergeWarden check in branch protection.

If a real finding has to be accepted, add a narrow waiver with an expiry date to
the base-branch policy rather than disabling the check. Waived findings stay
visible in the report, and an expired waiver brings the original finding back.
The [configuration reference](configuration.md) has the exact syntax.

Pin the Action to a release tag, or to the exact release commit if you want a
build that cannot change under you. MergeWarden does not publish a mutable `v0`
tag.

## Two things people ask next

**Will it be noisy?** On 46 merged human pull requests it said nothing on 44,
and both findings it did raise were correct.
[How that was measured](study/what-a-zero-config-install-reports.md).

**What if it flags something we decided was fine?** Please open an issue with
the output. That is the most useful bug report this project can get.

## Where to go next

[Configuration](configuration.md) for policy and waivers, the
[Action reference](action-reference.md) for every input and output, and the
[security model](security-model.md) for what MergeWarden trusts and what it
refuses to.

If you run agents yourself rather than reviewing their pull requests, the same
engine ships as an [MCP server](../packages/mcp/README.md) that checks a change
against the scope you gave it, before a pull request exists.
