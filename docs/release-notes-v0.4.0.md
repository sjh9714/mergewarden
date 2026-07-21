# MergeWarden v0.4.0 Release Notes

MergeWarden v0.4.0 renames the project from Agent Gate and publishes the CLI
under the unscoped npm name `mergewarden`. The GitHub repository is now
`sjh9714/mergewarden`; old repository URLs redirect. The scoped package
`@jinhyuk9714/agent-gate` remains at v0.3.1 and is deprecated.

## Try It

```bash
npx --yes mergewarden@0.4.0 scan owner/repo#123
```

The CLI analyzes public pull requests without cloning, checking out,
installing, or executing target-repository code. Private repositories and
higher GitHub API limits use `GH_TOKEN`, with `GITHUB_TOKEN` as the fallback.

## Highlights

- Rename the base-branch policy file to `mergewarden.yml` and the PR body
  contract marker to `mergewarden-contract`. This is a clean break with no
  compatibility alias; see the [v0.4.0 migration guide](migration-v0.4.0.md).
- Rename default report outputs to `mergewarden-report.json` and
  `mergewarden-report.md`. Finding IDs keep the `agf_` prefix so existing
  waivers remain valid.
- Reposition the README around agent-specific boundaries: declared PR scope,
  agent-control-plane drift, and agentic workflow injection.
- Add integration guides for gating [Claude Code](integrations/claude-code.md)
  and [Codex](integrations/codex.md) pull requests.
- Publish the [AI-agent PR scan methodology](study/methodology.md) used for the
  v0.4.0 launch study.

The signed v0.3.x tags remain immutable. v0.4.0 is a new source, tarball, and
provenance identity under the MergeWarden name.

See the [v0.4.0 migration guide](migration-v0.4.0.md),
[CLI reference](cli.md), and [release checklist](release-checklist.md).
