# Package Lifecycle Script Drift

MergeWarden reports package lifecycle script drift when an AI-generated pull
request adds or changes one of these `package.json` scripts:

- `preinstall`
- `install`
- `postinstall`
- `prepare`

These checks are warning-mode by default.

## What The Findings Mean

`dependency/lifecycle-script-added` means a configured lifecycle script did not
exist in the base branch `package.json`, but exists in the pull request.

`dependency/package-script-drift` means a configured lifecycle script existed in
the base branch and its command changed in the pull request.

MergeWarden records the manifest path, script name, change kind, and before/after
commands when available. If package manifest content cannot be read, MergeWarden
emits `analysis/content-unavailable` instead of guessing.

## Why It Matters

Package lifecycle scripts can run during dependency installation, package
publishing, or local setup workflows. For AI-generated pull requests, adding or
changing these scripts is a high-signal review boundary because the change can
affect CI, developer machines, and downstream consumers.

This finding does not prove the script is malicious. It says the pull request
changed execution behavior that maintainers should review before merge.

## What To Check

- Does the script run repository-local code?
- Does it download or execute remote code?
- Does it read credentials, environment variables, tokens, or CI-only paths?
- Is the script expected for the pull request's stated task?
- Does the package already use lifecycle scripts in a documented release flow?
- Is the command pinned, reviewable, and easy to reproduce?

## Common Lower-Risk Cases

- A package already has lifecycle scripts and the change updates a documented
  build or release preparation command.
- The script calls a checked-in tool with a small, reviewable diff.
- The change is paired with maintainer-owned release documentation.

These cases can still stay in warn mode until the repository has enough signal
to decide whether the rule is low-noise.

## Configuration

The default policy checks root and nested package manifests:

```yaml
package_scripts:
  enabled: true
  paths:
    - package.json
    - "**/package.json"
  lifecycle_scripts:
    - preinstall
    - install
    - postinstall
    - prepare
  severity: warn
```

Disable this rule family if it is too noisy for a repository:

```yaml
package_scripts:
  enabled: false
```

Raise severity only after observing useful signal in warn mode:

```yaml
package_scripts:
  severity: error
```

## What Is Not Covered Yet

MergeWarden does not currently detect dependency additions, lockfile mismatch,
package manager-specific install semantics, or maintainer override records.
Those remain future dependency evidence work.
