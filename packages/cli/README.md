# MergeWarden CLI

Reads a GitHub pull request through the API and reports what a maintainer would
normally check by hand. It never clones the repository, never executes
pull-request-controlled code, and never calls a language model.

The npm package is `mergewarden` and the installed executable is `mergewarden`.

Most people run this as a [GitHub Action](https://github.com/sjh9714/mergewarden)
so it happens on every pull request. The CLI is for looking at one pull request,
or a whole queue, from your terminal.

## Read a whole queue

```console
npx mergewarden@0.10.3 triage owner/repository
```

```
20 open pull request(s) read. 9 have something a maintainer checks by hand.

#6941  update-unmanaged-certificates       no description · template unused
#7227  add-tests                           no linked issue · oversized
#7790  feat/dedup-dynamic-upstreams        no linked issue · template unused

Nothing was closed, labelled, or commented on.
```

**This needs `GH_TOKEN` set, even on a public repository.** It makes one request
per pull request, and GitHub allows 60 an hour without one. A personal access
token with no scopes selected is enough, since nothing here writes. Without one
it reports what it could not read and exits non-zero rather than showing a queue
it only half saw.

## Scan one pull request

```console
npx mergewarden@0.10.3 scan owner/repository#123
```

Full pull request URLs are accepted too. A single public pull request works
without a token.

```console
mergewarden scan https://github.com/owner/repository/pull/123 --format markdown
mergewarden scan owner/repository#123 --config policies/mergewarden.yml --mode warn
```

Set `GH_TOKEN` (preferred) or `GITHUB_TOKEN` for private repositories and higher
rate limits. There is deliberately no command-line flag for the token, because
flags end up in shell history and CI logs.

Exit codes are stable. `scan` and `replay` return `0` for a complete pass or
warning, `1` for a complete block decision, and `2` for usage, API,
configuration, or incomplete-analysis failures.

`triage` differs, because a partly-read queue is still worth printing: `0` when
every pull request was read, `1` when some could not be and the answer is
therefore partial, and `2` when the arguments were wrong or the listing itself
failed.

## Replay a local fixture

```console
mergewarden replay path/to/fixture
```

A fixture directory contains `mergewarden.yml`, `fixture.json`, and optionally
`pr-body.md`. Replay is fully local and deterministic, with no network and no
token. The repository's own fixtures live under
[`fixtures/`](https://github.com/sjh9714/mergewarden/tree/main/fixtures) and are
not bundled in this package.

Run `mergewarden --help` for the complete command reference.

## Security boundary

The policy comes from the pull request's base commit, never from the pull
request itself. It does not check out either branch, evaluate workflow
expressions, run package scripts, or call a model during analysis.

License: MIT. See `THIRD_PARTY_NOTICES.md` for bundled dependency notices.
