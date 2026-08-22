# MergeWarden CLI

Paste a GitHub PR and see what deserves human review from your terminal.
MergeWarden reads the GitHub API without cloning the repository, executing PR
code, or calling a language model.

The npm package and executable are both named `mergewarden`.

## Scan one pull request

```console
npx --yes mergewarden@0.10.4 scan https://github.com/owner/repository/pull/123
```

The compact form works too.

```console
npx --yes mergewarden@0.10.4 scan owner/repository#123
```

A public PR needs no token. Set `GH_TOKEN` for private repositories or a higher
API rate limit. `GH_TOKEN` takes precedence over `GITHUB_TOKEN`.

```console
mergewarden scan owner/repository#123 --format markdown
mergewarden scan owner/repository#123 --format json
mergewarden scan owner/repository#123 --config policies/mergewarden.yml --mode warn
```

Exit codes are stable. `scan` and `replay` return `0` for a complete pass or
warning, `1` for a complete block decision, and `2` for usage, API,
configuration, or incomplete-analysis failures.

## Install on every PR

Most repositories should use the
[GitHub Action](https://github.com/sjh9714/mergewarden) after trying a real scan.
The Action uses the same collector and analysis engine.

## Local replay

```console
mergewarden replay path/to/fixture
```

Replay is local and deterministic. A fixture contains `mergewarden.yml`,
`fixture.json`, and optionally `pr-body.md`.

## Advanced commands

`demo` scans a bundled synthetic fixture without a network request.

```console
mergewarden demo
```

`triage` reads a whole public repository queue and requires `GH_TOKEN` so it
does not silently stop at GitHub's anonymous rate limit.

```console
GH_TOKEN=github_pat_... mergewarden triage owner/repository
```

`triage` returns `0` when every PR was read, `1` for a partial queue, and `2`
for invalid arguments or a failed listing request.

## Security boundary

Policy comes from the exact base commit. MergeWarden never checks out either
branch, evaluates workflow expressions, runs package scripts, or calls a model.

Run `mergewarden --help` for the full command reference.

License is MIT. Bundled dependency notices are in `THIRD_PARTY_NOTICES.md`.
