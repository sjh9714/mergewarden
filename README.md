# MergeWarden

[![Release](https://img.shields.io/github/v/release/sjh9714/mergewarden?label=release)](https://github.com/sjh9714/mergewarden/releases)
[![CI](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml)
[![MergeWarden](https://github.com/sjh9714/mergewarden/actions/workflows/mergewarden.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/mergewarden.yml)
[![License](https://img.shields.io/github/license/sjh9714/mergewarden)](LICENSE)

Paste a GitHub PR and see what deserves human review. MergeWarden checks
workflow permissions, agent instructions, untrusted prompt inputs, and install
scripts. It is deterministic and never checks out the branch or calls an LLM.
No checkout. No LLM.

## Scan a public PR

[**Open the public PR scanner**](https://sjh9714.github.io/mergewarden/)

Paste a full GitHub PR URL or `owner/repository#number`. The scan runs in your
browser without a login or token. Nothing is installed and no code is executed.
The [getting started guide](docs/getting-started.md) explains each result state
and the install path.

## A real result

[This public PR](https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/22)
looks like a one-line documentation edit. It changes `CLAUDE.md`, which can steer
future coding-agent runs in the repository.

```text
1 change deserves review

Agent control-plane file changed
CLAUDE.md

This file can change how AI agents behave in future PRs.
What to check
Review the control-plane change before merging.
```

MergeWarden points to the file and the review question. It does not judge the
author or attempt a general code review.

## Four focused checks

| Check                   | What deserves review                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Workflow permissions    | A workflow gains write access, uses a dangerous trigger, or depends on a moving action reference |
| Agent instructions      | A PR changes `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, or another file that steers coding agents    |
| Untrusted prompt inputs | Pull request text reaches an agent prompt in a workflow                                          |
| Install scripts         | A package manifest adds or changes install-time lifecycle code                                   |

The [configuration reference](docs/configuration.md) covers each deterministic
rule and its severity.

## Scan from the CLI

Scan the same public PR from a terminal without cloning it.

```bash
npx --yes mergewarden@0.10.4 scan https://github.com/owner/repository/pull/123
```

Use `GH_TOKEN` for private repositories or a higher GitHub API rate limit.
Tokens are accepted only through the environment so they do not land in shell
history. JSON and Markdown output are available through `--format`.

## Add the Action

Create `.github/workflows/mergewarden.yml`.

```yaml
name: MergeWarden PR Risk Check

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  mergewarden:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/mergewarden@v0.10.4
        with:
          comment: auto
```

`comment: auto` stays quiet when there is nothing actionable and updates one
comment when a finding needs attention. The default Action behavior remains
unchanged for existing users.

For an immutable install, pin the release commit.

MergeWarden does not publish or recommend a mutable `v0` tag.

```yaml
- uses: sjh9714/mergewarden@d63b4fc8c09c540375f039ecd30d2fce56abf31f
```

## Safety boundaries

- The web scanner talks directly to the public GitHub API. It has no backend,
  database, account, or telemetry.
- The web scanner does not execute pull-request code. The Action also never
  checks out either branch.
- Policy is loaded from the exact base commit, never from the untrusted PR head.
- Analysis never calls a language model. The same evidence produces the same
  finding IDs and policy digest.
- Incomplete evidence is reported as incomplete and is never presented as a
  pass.

Read the [security model](docs/security-model.md) and
[evidence model](docs/evidence-model.md) for the full trust boundary.

## Research and advanced interfaces

The [public research](docs/study/what-2204-agent-prs-showed.md) explains what
the rules found across 2,204 merged agent-authored PRs. It is supporting
evidence, not a prerequisite for using the scanner.

The [documentation index](docs/README.md) includes configuration, Action and
CLI references, coding-tool integrations, and reproducible studies. Existing
advanced interfaces remain available there, including
[`triage`](docs/triage.md) for a repository queue and the
[MCP server](packages/mcp/README.md) for checking agent work before a PR exists.

## Contributing

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Every rule needs a passing fixture, a failing fixture, and a snapshot of the
report a person reads. See the [contribution guide](CONTRIBUTING.md) and the
[good first issues](https://github.com/sjh9714/mergewarden/labels/good%20first%20issue).

[简体中文](README.zh-CN.md)

## License

[MIT](LICENSE)
