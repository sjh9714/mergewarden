# MergeWarden for AI PRs

[![Release](https://img.shields.io/github/v/release/sjh9714/mergewarden?label=release)](https://github.com/sjh9714/mergewarden/releases)
[![CI](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml)
[![MergeWarden](https://github.com/sjh9714/mergewarden/actions/workflows/mergewarden.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/mergewarden.yml)
[![License](https://img.shields.io/github/license/sjh9714/mergewarden)](LICENSE)

**AI coding tools open pull requests faster than anyone can read them. MergeWarden
tells you which ones need a closer look, and why.**

## The situation it is built for

An agent opens a pull request titled "Document the release process". The diff
touches four files. Three of them are documentation. The fourth is your release
workflow.

Nothing in the title said that would happen, and in a busy week nobody notices.
MergeWarden notices, and leaves one comment saying so.

It reports facts you could have checked by hand. It does not review your code,
grade the contributor, or merge anything.

## See it work, without installing anything

This runs a small example that ships inside the tool. No token, no repository,
no network:

```bash
npx --yes mergewarden@0.10.1 demo
```

```
  Repository   demo-org/demo-service
  Pull request #482 "Document the release process"
  Author       an agent on branch codex/document-releasing
  Declared     allowed_paths: docs/**
  Changed      docs/releasing.md, .github/workflows/release.yml, AGENTS.md, package.json

MergeWarden: NEEDS REVIEW

ERROR contract/out-of-scope
Message: .github/workflows/release.yml changed outside the allowed contract scope.
Path: .github/workflows/release.yml
```

Now point it at a real pull request. Public repositories need no token:

```bash
npx --yes mergewarden@0.10.1 scan owner/repository#123
```

![The full mergewarden demo report scrolling past in a terminal](docs/assets/mergewarden-demo.gif)

If a queue has built up, read the whole thing at once instead. This is real
output from a public repository:

```bash
npx --yes mergewarden@0.10.1 triage owner/repository
```

```
20 open pull request(s) read. 9 have something a maintainer checks by hand.

#6941  update-unmanaged-certificates       no description · template unused
#7227  add-tests                           no linked issue · oversized
#7790  feat/dedup-dynamic-upstreams        no linked issue · template unused
#7290  natsort                             template unused
#7669  webtransport-reverse-proxy          oversized
#7878  rfc9440-client-cert-placeholders    oversized
#7912  feat/fastcgi-server-addr            template unused
#7913  slowloris-idle-timeout              no linked issue
#7922  fix/network-proxy-missing-host      no linked issue

Nothing was closed, labelled, or commented on.
```

Every row is something you would have checked by hand, and you can confirm any
of them in a few seconds. The other eleven pull requests are not listed because
there was nothing to say about them. Nothing is written back to GitHub, and the
command needs no write access.

For private repositories, or to raise your API rate limit, set `GH_TOKEN`.
There is deliberately no way to pass a token as a command-line flag, because
flags end up in shell history and CI logs.

## What it looks for

| It notices when                                            | Which matters because                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A pull request edits files outside what it said it would   | An agent asked to update docs also changed your billing code                    |
| `AGENTS.md`, `CLAUDE.md`, `.mcp.json` or `.cursor/` change | These files instruct every future agent working in your repository              |
| A workflow gains permissions it did not have before        | It can now write where it could previously only read                            |
| Pull request text reaches an agent prompt                  | A stranger can put instructions in a title and have your automation follow them |
| An action, workflow or container is not pinned             | Somebody else can change what runs in your CI without opening a pull request    |
| An install script appears in a package manifest            | That code runs during `npm install`, before any human reads it                  |
| Risky code changes with no matching test changes           | Worth a look, not a verdict                                                     |

Every finding names the rule, the file, and the evidence, and carries an ID you
can quote when you discuss or dismiss it.

## Run it on every pull request

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
      - uses: sjh9714/mergewarden@v0.10.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
          comment: auto
```

That is the whole setup. No checkout step, no build, no configuration file, and
nothing installed into your repository. Until you add a `mergewarden.yml` of
your own, a sensible default policy applies.

Most pull requests cross no boundary. Those pass silently, and the details go to
the Actions job summary rather than to a comment. You hear from MergeWarden when
something is worth hearing about. Push a fix and the existing comment rewrites
itself to `PASSED` instead of being deleted, so a stale review request cannot
outlive the problem it described.

Pull requests from forks get a read-only token from GitHub, so they are never
commented on.

For a build that cannot change under you, pin the release commit instead of the
tag. MergeWarden does not publish or recommend a mutable `v0` tag.

```yaml
- uses: sjh9714/mergewarden@c32fb900b65708ea7c875b8ec4244c0983343970
```

## What it will not do

It does not judge your code. It has no opinion on style, naming, or whether a
change deserves to be merged, and it does not infer anything from how the
description is written.

It never closes, labels, or merges anything. There is no `--close` flag, and a
test in this repository asserts there never will be one. A pull request that a
bot closes in error does not get reopened by the person who gave up on it.

It is also careful about what it trusts:

- It does not execute pull-request code, and never checks the branch out.
- It reads your settings from the exact base commit of your branch, never from
  the pull request itself, so a pull request cannot rewrite the rules it is
  judged by.
- It never calls a language model, so the same pull request always produces the
  same report.
- If it cannot see everything it needs, it says so and fails rather than
  reporting a pass it cannot stand behind.

The [security model](docs/security-model.md) explains the boundaries and the
known limits.

## Turning it on gradually

Nothing is blocked on day one. With `mode: warn` and `fail-on-block: false`,
MergeWarden reports and does nothing else. A reasonable order:

1. Run it in `warn` for a week and read what it tells you.
2. Raise individual checks to `error` once you agree with them.
3. Set `mode: block` and `fail-on-block: true`.
4. Require the MergeWarden check in branch protection.

Each of those is one line in [configuration](docs/configuration.md).

Reports end with one of five verdicts, kept deliberately distinct:

- `PASSED`: analysis finished, nothing active to report.
- `OBSERVED FINDINGS`: evidence recorded, decision unchanged.
- `NEEDS REVIEW`: a person should look.
- `BLOCKED`: policy rejected the change.
- `ANALYSIS INCOMPLETE`: something could not be read, so no verdict is claimed.

Worried about noise? On 46 merged human pull requests it stayed quiet on 44, and
both of the findings it did raise were correct
([how that was measured](docs/study/what-a-zero-config-install-reports.md)). If
it ever flags something your team already decided was fine, please open an issue
with the output. That is the most useful bug report this project can get.

## Documentation

[Getting started](docs/getting-started.md) walks through installing it and
reading your first report. The [documentation index](docs/README.md) has
everything else, including the [configuration reference](docs/configuration.md).

If you run the agents yourself rather than reviewing their pull requests, the
same engine ships as an [MCP server](packages/mcp/README.md). It checks a change
against the scope you gave the agent before a pull request exists.

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
