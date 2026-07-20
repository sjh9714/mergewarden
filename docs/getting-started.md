# Getting Started

## 1. Try a PR Without Installing

```bash
npx --yes mergewarden@0.4.0 scan owner/repository#123
```

Public repositories work without a token. Set `GH_TOKEN`, or
`GITHUB_TOKEN` as a fallback, for private repositories and higher API limits.

## 2. Add the Checkout-Free Action

Create `.github/workflows/mergewarden.yml`:

```yaml
name: MergeWarden

on:
  pull_request:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled, ready_for_review]

permissions:
  contents: read
  pull-requests: read

jobs:
  mergewarden:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/mergewarden@v0.4.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
```

Do not add checkout. MergeWarden reads the PR through GitHub APIs and loads
policy from the exact base commit.

## 3. Read the First Report

Start without `mergewarden.yml` or with `mode: warn`. A confirmed missing
default config selects the built-in policy; other retrieval errors fail.

- `PASSED`: complete analysis, no active warning/error findings.
- `OBSERVED FINDINGS`: evidence found in observe mode.
- `NEEDS REVIEW`: warn-mode evidence needs a human decision.
- `BLOCKED`: block-mode policy rejected the change.
- `ANALYSIS INCOMPLETE`: required evidence was unavailable; the run fails.

## 4. Tune Policy

Copy relevant settings from [configuration](configuration.md). Prefer per-check
severity over broad exceptions. If a legitimate finding must be accepted, add
an exact, expiring waiver to the base-branch policy.

## 5. Enforce

After enough warn-mode observation:

1. Set stable checks to `error`.
2. Set `mode: block`.
3. Set `fail-on-block: true`.
4. Require the MergeWarden check in branch protection.

Pin the Action to the release tag or, for maximum assurance, the exact release
commit SHA. MergeWarden does not publish a mutable `v0` tag.
