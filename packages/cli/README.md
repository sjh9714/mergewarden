# Agent Gate CLI

Agent Gate is a checkout-free policy gate for AI-generated GitHub pull requests. It reads pull request metadata and selected file contents through the GitHub API; it never clones the target repository or executes pull-request-controlled code.

The npm package is `@jinhyuk9714/agent-gate`; the installed executable remains `agent-gate`.

## Try a public pull request

```console
npx @jinhyuk9714/agent-gate@0.3.1 scan owner/repository#123
```

Full GitHub pull request URLs are also accepted. Authentication is optional for public repositories. For private repositories or higher API limits, set `GH_TOKEN` (preferred) or `GITHUB_TOKEN` in the environment.

```console
agent-gate scan https://github.com/owner/repository/pull/123 --format markdown
agent-gate scan owner/repository#123 --config policies/agent-gate.yml --mode warn
```

Exit codes are stable: `0` for a complete pass or warning, `1` for a complete block decision, and `2` for usage, API, configuration, or incomplete-analysis failures.

## Replay a local fixture

```console
agent-gate replay ./fixtures/example
```

A fixture contains `agent-gate.yml`, `fixture.json`, and optionally `pr-body.md`. Replay remains local and deterministic.

Run `agent-gate --help` for the complete command reference.

## Security boundary

Agent Gate fetches the policy from the pull request base commit. It does not checkout either branch, evaluate workflow expressions, run package scripts, or call an LLM during analysis.

License: MIT. See `THIRD_PARTY_NOTICES.md` for bundled dependency notices.
