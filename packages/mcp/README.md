# mergewarden-mcp

An MCP server that answers one question: **did this change stay inside the scope it was given?**

Out-of-scope edits are a documented failure mode of coding agents, and the usual
advice is to check by hand — run `git diff --name-only` after a session and see
whether anything unexpected shows up. This does that comparison mechanically,
against the paths you actually asked for.

## Install

Claude Code reads `.mcp.json`; other clients use their own MCP config file.

```json
{
  "mcpServers": {
    "mergewarden": {
      "command": "npx",
      "args": ["-y", "mergewarden-mcp"]
    }
  }
}
```

## The tool

### `check_change_scope`

| Input          |                                                        |
| -------------- | ------------------------------------------------------ |
| `allowedPaths` | Globs the change was scoped to, e.g. `["src/auth/**"]` |
| `changedPaths` | What was actually changed, from `git diff --name-only` |
| `blockedPaths` | Optional globs the change was told not to touch        |
| `task`         | Optional one-line description, recorded verbatim       |

It returns the paths that escaped, any edits to agent-instruction files
(`AGENTS.md`, `CLAUDE.md`, `.mcp.json` and similar), and a ready-to-paste
contract block for the pull request body.

```
NEEDS REVIEW

2 path(s) outside the declared scope. 1 agent-instruction file(s) changed —
these steer every future agent run in this repository.

- ERROR contract/out-of-scope: src/billing/invoice.ts changed outside the allowed contract scope.
- ERROR agent-control-plane/drift: This file can change how AI agents behave in future PRs.
```

## What it is and is not

**It runs the same engine as the [MergeWarden GitHub Action](https://github.com/sjh9714/mergewarden), on the same default policy.** A clean
result here is the result the gate produces later — not a second opinion that
happens to agree.

**It is deterministic and offline.** No network, no token, no model call. The
same inputs always produce the same findings.

**It only checks what a path list can support**: contract scope, blocked paths,
and agent-control-plane drift. Workflow permission changes, dependency lifecycle
scripts and prompt-injection checks need file contents, so they are not here —
run `npx mergewarden scan owner/repo#123` once the pull request exists.

**It does not judge the change.** Whether the code is correct is not a question
a path comparison can answer, and nothing here pretends otherwise.

## Why the contract block

The scan study behind this project found **0 of 2,204** merged agent pull
requests declared what they intended to change. The intent existed — the agent
was told what to do — but nothing carried it into the pull request where a
reviewer could check against it.

That is the gap this closes. The scope is stated while it is still known, and
the block it emits is the same one `contract/out-of-scope` parses back out later.

## Registry

Listed as **`io.github.sjh9714/mergewarden`** in the
[official MCP registry](https://registry.modelcontextprotocol.io/v0/servers?search=mergewarden).

## Publishing

`server.json` is the MCP registry manifest. Two constraints worth knowing before
editing it:

- Its `name` must stay identical to `mcpName` in `package.json`. The registry
  verifies npm ownership by comparing them, and a mismatch only surfaces at
  registry-publish time, after the npm release is already out. A test enforces
  the match.
- `description` is capped at **100 characters** by the registry. Nothing local
  catches that; `mcp-publisher validate` does, so run it before publishing.

Publishing is `mcp-publisher login github` (device flow) then
`mcp-publisher publish`, using the official binary from the
[registry releases](https://github.com/modelcontextprotocol/registry/releases) —
the `mcp-publisher` package on npm is an unrelated project with the same name.

MIT. Part of [MergeWarden](https://github.com/sjh9714/mergewarden).
