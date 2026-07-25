# MergeWarden v0.5.0 Release Notes

v0.5.0 fixes the thing that mattered most and was hardest to see: **a
zero-configuration install reported nothing.**

Not "reported little" — nothing. `agent_detection.authors`, `branch_patterns`
and `body_patterns` all defaulted to empty arrays. Agent detection could
therefore never fire, and because `contract.required_for` defaults to `[agent]`,
the project's headline check — _did this pull request stay inside the scope it
declared?_ — was unreachable without configuration nobody knew to write.

This was measured, not suspected. Fourteen recent merged pull requests from
next.js, react, vscode, deno, vite, ruff, prettier and vue were scanned with the
shipped defaults. All fourteen returned `0 error, 0 warning, 0 info`.

## Try It

```bash
npx --yes mergewarden@0.5.0 demo
```

That command is also new, and it exists because of the same problem.

## Highlights

**Working agent-detection defaults.** The defaults are now the cohort
definitions from the [2,204-PR study](study/methodology.md), which are the
signatures actually observed in the wild rather than guesses:
`devin-ai-integration[bot]` and `copilot-swe-agent[bot]` authors; `codex/**`,
`claude/**`, `cursor/**`, `copilot/**` and `devin/**` branches; and the
`Generated with Claude Code` body marker. Labels stay empty because label
conventions are per-repository and cannot be guessed.

**Gemini and Qwen control planes.** `GEMINI.md`, `QWEN.md`, their `**/`
variants, and `.gemini/**` join the default control-plane list. GitHub indexes
8,208 `GEMINI.md` and 1,376 `QWEN.md` files, so a pull request quietly steering
every future Gemini run in a repository was previously invisible.

**`mergewarden demo`.** Analyzes an example pull request bundled inside the CLI
— no token, no network, no repository. It runs the _default_ policy, so the 13
findings it reports are a verifiable claim about what a zero-config install
does. A test enforces that: if the demo ever needs a bespoke policy to stay
interesting, the default policy is what should change.

**A shorter pull request comment.** The decision, one `Why` line with the path
inline, one `Next` line, one `Findings` line. A 12-finding report now shows 5
lines above the fold instead of 30; the run summary moved inside the `<details>`
element rather than being dropped. From two rounds of feedback by the first
outside maintainer to evaluate the Action.

**The terminal report no longer hides errors.** It bounds itself to 10 findings
and used to take the first 10 in evaluation order, so a busy report could show
ten warnings and truncate every error. Selection is now by severity.

## Breaking Changes

There are no API breaks, but **default behaviour changes**, which is why this is
a minor bump rather than a patch:

- Agent pull requests now produce `agent/origin-detected` (info), and when they
  carry no declared contract, `contract/missing`. In the default `warn` mode
  that is a `needs-review` decision, not a block.
- Pull requests touching `GEMINI.md` or `QWEN.md` now produce an `error`-severity
  `agent-control-plane/drift` finding.
- Pull requests authored by humans are unaffected.

To restore the previous behaviour exactly, set the keys explicitly to empty:

```yaml
agent_detection:
  authors: []
  branch_patterns: []
  body_patterns: []
```

## Upgrading

```yaml
- uses: sjh9714/mergewarden@v0.5.0
```

No configuration change is required, and no migration is needed. Repositories
already declaring `agent_detection` keys are unaffected — an explicit setting
replaces the default for that key.
