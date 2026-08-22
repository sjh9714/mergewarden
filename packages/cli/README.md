# MergeWarden CLI

Rank external pull requests before code review, then inspect deterministic PR
risks. MergeWarden reads the GitHub API without cloning the repository,
executing PR code, or calling a language model.

The npm package and executable are both named `mergewarden`.

## Review a repository queue

`triage` reads open pull requests and orders them by missing issue links, thin
descriptions, skipped templates, and oversized changes. It never closes,
labels, scores, or comments.

```console
GH_TOKEN=github_pat_... npx --yes mergewarden@0.10.4 triage owner/repository
```

The token is required because a full CLI queue uses more API requests than the
public browser view. `triage` returns `0` when every selected PR was read, `1`
for a partial queue, and `2` for invalid arguments or a failed listing request.

## Inspect one pull request

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

## Advanced command

`demo` scans a bundled synthetic fixture without a network request.

```console
mergewarden demo
```

## Security boundary

Policy comes from the exact base commit. MergeWarden never checks out either
branch, evaluates workflow expressions, runs package scripts, or calls a model.

Run `mergewarden --help` for the full command reference.

License is MIT. Bundled dependency notices are in `THIRD_PARTY_NOTICES.md`.
