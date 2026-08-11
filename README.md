# MergeWarden

[![Release](https://img.shields.io/github/v/release/sjh9714/mergewarden?label=release)](https://github.com/sjh9714/mergewarden/releases)
[![CI](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml)
[![MergeWarden](https://github.com/sjh9714/mergewarden/actions/workflows/mergewarden.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/mergewarden.yml)
[![License](https://img.shields.io/github/license/sjh9714/mergewarden)](LICENSE)

**A pull request quietly edited your `CLAUDE.md`.**

In the diff it reads as a documentation tidy-up. That file is what every coding
agent reads before it touches your repository, so the change outlives the pull
request and shows up in nothing anyone reviews afterwards.

MergeWarden leaves one comment when that happens. **It closes nothing.**

## What that actually looks like

![An agent pull request adds one line to CLAUDE.md, telling agents to skip the test suite for documentation changes. MergeWarden's comment appears beneath the diff flagging NEEDS REVIEW because this file can change how AI agents behave in future PRs.](docs/assets/quiet-edit.gif)

This is a real pull request, titled "docs: tidy up the contributor notes", whose
whole diff is one added line in `CLAUDE.md`.

```
MergeWarden: NEEDS REVIEW

Why:  This file can change how AI agents behave in future PRs. (CLAUDE.md)
Next: Review the agent instruction/tooling change before merging.
```

[The pull request](https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/22)
and [the run that produced it](https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions)
are public, so you can check the output against the diff yourself.

It works whether or not an agent opened the pull request. That one says
`Agent detected: no`.

Watched by default: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `QWEN.md`,
`.mcp.json`, `.cursor/`, `.codex/`, `.gemini/`,
`.github/copilot-instructions.md`, `claude_desktop_config.json`.

**How often is this?** We scanned 2,204 merged agent-authored pull requests on
public GitHub and **3.9%** of them changed a file like this. That is not a daily
event. It is the kind of thing you want to hear about when it happens rather
than find six weeks later.

**Does review catch it?** Measured, no. 68 of those pull requests modified an
existing instruction file, and **not one** drew a human review comment on that
file, including in starred repositories where the pull request itself was
formally reviewed. The only instruction file that got line by line review in the
whole sample was one being created
([the measurement](docs/study/who-reviews-the-steering-files.md)).

## Install

One file, `.github/workflows/mergewarden.yml`:

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
      - uses: sjh9714/mergewarden@v0.10.3
        with:
          comment: auto
```

That is the whole setup. There is no checkout step, no build, no config file,
and no token to create: the Action uses the one GitHub already gives the job.
Nothing is blocked from merging until you decide otherwise.

`comment: auto` is the only option that does anything on a fresh install. It
means MergeWarden stays silent when there is nothing to say, and everything else
goes to the Actions job summary. When it does comment, pushing a fix rewrites
that same comment to `PASSED` instead of deleting it, so a stale review request
cannot outlive the problem it described.

Pull requests from forks get a read-only token from GitHub, so they are never
commented on.

For a build that cannot change under you, pin the release commit instead of the
tag. MergeWarden does not publish or recommend a mutable `v0` tag.

```yaml
- uses: sjh9714/mergewarden@d63b4fc8c09c540375f039ecd30d2fce56abf31f
```

## What else it checks

Once it is installed, these come with it. Each one is a fact about the diff, not
a judgement about the contributor.

| It also notices                                            | Because                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A workflow gained a permission it did not have on the base | It can now write where it could previously only read                            |
| `pull_request_target` combined with a head checkout        | That hands your repository's secrets to whoever opened the pull request         |
| An action, reusable workflow or container on a moving tag  | Somebody else can change what runs in your CI without opening a pull request    |
| An install or prepare script added to a package manifest   | That code runs during `npm install`, before any human reads it                  |
| Pull request text reaching an agent prompt                 | A stranger can put instructions in a title and have your automation follow them |
| Files outside the scope a pull request declared for itself | An agent asked to update docs also changed your billing code                    |

Every finding names the rule, the file, the evidence, and an ID you can quote
when you discuss or dismiss it. The
[configuration reference](docs/configuration.md) covers turning individual
checks up, down, or off.

## What it will not do

**It never closes, labels, or merges anything.** There is no `--close` flag, and
a test in this repository asserts there never will be one. A pull request closed
by a bot in error does not get reopened by the person who gave up on it.

If what you want is for the pull requests to stop arriving, this is the wrong
tool and you should look at an auto-closing action instead. MergeWarden is for
deciding yourself, faster.

It also does not judge your code. It has no opinion on style, naming, or whether
a change deserves to be merged, and it infers nothing from how the description is
written.

On what it trusts:

- It does not execute pull-request code, and never checks the branch out.
- It reads your settings from the exact base commit of your branch, never from
  the pull request itself, so a pull request cannot rewrite the rules it is
  judged by.
- It never calls a language model, so the same pull request always produces the
  same report.
- If it cannot see everything it needs, it says so and fails rather than
  reporting a pass it cannot stand behind.

The [security model](docs/security-model.md) has the boundaries and the known
limits.

## Reading a whole queue at once

If pull requests have piled up, `triage` reads all the open ones and lists only
those with something you would have checked by hand.

**This one needs a token**, even on a public repository, because it makes one
request per pull request and GitHub allows 60 an hour without one. A
[personal access token](https://github.com/settings/personal-access-tokens/new)
with **no scopes selected** is enough, since nothing here writes.

```bash
export GH_TOKEN=github_pat_...
npx --yes mergewarden@0.10.3 triage owner/repository
```

```
20 open pull request(s) read. 9 have something a maintainer checks by hand.

#6941  update-unmanaged-certificates       no description · template unused
#7227  add-tests                           no linked issue · oversized
#7790  feat/dedup-dynamic-upstreams        no linked issue · template unused

Nothing was closed, labelled, or commented on.
```

Without a token it tells you what it could not read and exits non-zero, rather
than showing you a queue it only half saw. [More on triage](docs/triage.md).

## Documentation

[Getting started](docs/getting-started.md) walks through the first week. The
[documentation index](docs/README.md) has the rest, including the
[configuration reference](docs/configuration.md).

Running the agents yourself rather than reviewing their pull requests? The same
engine ships as an [MCP server](packages/mcp/README.md) that checks a change
against the scope you gave it, before a pull request exists.

## Contributing

```bash
pnpm install
pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm format:check
```

Every rule needs a passing fixture, a failing fixture, and a snapshot of what a
person would read. The
[good first issues](https://github.com/sjh9714/mergewarden/labels/good%20first%20issue)
each name the file to change, the command to verify it, and what done looks
like. See the [contribution guide](CONTRIBUTING.md).

[简体中文](README.zh-CN.md)

## License

[MIT](LICENSE)
