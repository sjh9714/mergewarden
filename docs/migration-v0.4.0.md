# Migrating to MergeWarden v0.4.0

Agent Gate is now MergeWarden. v0.4.0 is a rename release: detection rules,
report formats, finding IDs, and the policy schema are unchanged from v0.3.1.

## Name Changes

| Item                 | Before (≤ v0.3.1)             | After (v0.4.0)                 |
| -------------------- | ----------------------------- | ------------------------------ |
| GitHub repository    | `sjh9714/Agent-Gate`          | `sjh9714/mergewarden`          |
| GitHub Action        | `uses: sjh9714/Agent-Gate`    | `uses: sjh9714/mergewarden`    |
| npm package          | `@jinhyuk9714/agent-gate`     | `mergewarden`                  |
| CLI executable       | `agent-gate`                  | `mergewarden`                  |
| Base policy file     | `agent-gate.yml`              | `mergewarden.yml`              |
| PR contract marker   | `<!-- agent-gate-contract`    | `<!-- mergewarden-contract`    |
| Default report files | `agent-gate-report.{json,md}` | `mergewarden-report.{json,md}` |

## What You Need to Do

1. Update workflow `uses:` references to `sjh9714/mergewarden@v0.4.0` or the
   full release commit SHA. Old `sjh9714/Agent-Gate` references keep working
   through GitHub's repository redirect, but update them for clarity.
2. Rename `agent-gate.yml` on your base branch to `mergewarden.yml`. There is
   no compatibility alias: v0.4.0 only reads `mergewarden.yml`, and versions up
   to v0.3.1 only read `agent-gate.yml`. Land the rename and the Action version
   bump in the same pull request to avoid a window where the policy file is not
   found and the built-in warn policy applies.
3. Update agent instructions that emit PR contracts to use the
   `mergewarden-contract` marker.
4. Replace `npx @jinhyuk9714/agent-gate` with `npx mergewarden`. The scoped
   package stays published at v0.3.1 and is deprecated; it will receive no
   further updates.

## What Does Not Change

- Policy schema (`version: 1`), rule IDs, severities, and decisions.
- Finding IDs (still `agf_` + evidence hash), so existing waivers stay valid.
- The trust boundary: checkout-free, base-branch policy only, no runtime LLM.
