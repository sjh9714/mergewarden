# MergeWarden

[![Release](https://img.shields.io/github/v/release/sjh9714/mergewarden?label=release)](https://github.com/sjh9714/mergewarden/releases)
[![CI](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml)
[![MergeWarden](https://github.com/sjh9714/mergewarden/actions/workflows/mergewarden.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/mergewarden.yml)
[![License](https://img.shields.io/github/license/sjh9714/mergewarden)](LICENSE)

See which pull requests need context before code review.

Paste a public GitHub repository. MergeWarden surfaces missing issue links,
thin descriptions, skipped templates, and oversized changes. No login. No AI.

## Review a public repository

[**Open the public review queue**](https://sjh9714.github.io/mergewarden/)

Paste `owner/repository` or a full GitHub repository URL. The browser reads the
latest thirty open pull request summaries, removes trusted repository roles and
known maintenance automation, then loads details for at most ten external pull
requests.

Rows are ordered by deterministic facts a maintainer would otherwise check
before reading code.

| Fact             | What it means                                                                 |
| ---------------- | ----------------------------------------------------------------------------- |
| No linked issue  | The body has no issue number, issue URL, or closing keyword                   |
| Thin description | The body has fewer than 80 characters of prose                                |
| Template unused  | The repository has a visible PR template structure that the body did not keep |
| Oversized        | The change exceeds 50 files or 1,500 changed lines                            |

First contribution is shown as context and never used as a score. MergeWarden
does not call a contribution spam, low quality, or AI generated. It never
closes, labels, scores, or comments on a pull request.

The queue uses public metadata and the base branch pull request template. It
does not fetch changed file contents, execute code, use a backend, or store the
target.

For a larger authenticated queue, use the CLI.

```bash
GH_TOKEN=... npx --yes mergewarden@0.10.4 triage owner/repository
```

## Run the detailed PR risk scan

The same page accepts a full pull request URL or `owner/repository#number`.
Every queue row links to this detailed scan.

The detailed scan checks four security boundaries.

| Check                   | What deserves review                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Workflow permissions    | A workflow gains write access, uses a dangerous trigger, or depends on a moving Action reference |
| Agent instructions      | A PR changes `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, or another file that steers coding agents    |
| Untrusted prompt inputs | Pull request text reaches an agent prompt in a workflow                                          |
| Install scripts         | A package manifest adds or changes install-time lifecycle code                                   |

Run the same scan from a terminal without cloning the target repository.

```bash
npx --yes mergewarden@0.10.4 scan https://github.com/owner/repository/pull/123
```

## Add the Action

The Action automates the detailed PR risk check. It does not order the review
queue.

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
comment when a finding needs attention. Existing Action defaults are unchanged.

For an immutable install, pin the release commit.

```yaml
- uses: sjh9714/mergewarden@d63b4fc8c09c540375f039ecd30d2fce56abf31f
```

## Safety boundaries

- The web app talks directly to the public GitHub API and has no telemetry.
- The queue reads metadata and one base branch template. The detailed scan reads
  only the files required by deterministic rules.
- Neither the web app nor the Action executes or checks out PR code.
- Policy comes from the exact base commit, never the untrusted PR head.
- Analysis never calls a language model.
- Incomplete evidence is reported as incomplete and never presented as a pass.

Read the [security model](docs/security-model.md) and
[evidence model](docs/evidence-model.md) for the full trust boundary.

## Evidence and advanced interfaces

[Does triage help?](docs/study/does-triage-help.md) records the existing queue
measurement and its main limit. It measured whether rows discriminate, not
whether maintainers save time. The current web queue remains a product
experiment until maintainers confirm that value.

The [documentation index](docs/README.md) includes configuration, Action and
CLI references, coding-tool integrations, reproducible studies, and the
[MCP server](packages/mcp/README.md).

## Contributing

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Every new rule needs a passing fixture, a failing fixture, and a report
snapshot. See the [contribution guide](CONTRIBUTING.md).

[简体中文](README.zh-CN.md)

## License

[MIT](LICENSE)
