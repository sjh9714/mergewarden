# Your First Agent Gate Report

Agent Gate is easiest to try in warn mode. A warning is not a failed install and
not proof that a pull request is unsafe. It is deterministic evidence that a
maintainer should review before merge.

## Decisions

`PASSED` means Agent Gate did not find configured warning or blocking evidence.
Normal review can continue.

`NEEDS HUMAN DECISION` means Agent Gate found warning-mode evidence. Review the
finding, tune policy if needed, and keep observing until the signal is low-noise
enough to promote.

`BLOCKED` means Agent Gate found blocking evidence. Fix the pull request, tune
the repository policy, or use your repository's normal override process.

## Finding ID

`Finding ID` is the short audit handle for a finding, such as
`agf_987ab9ddb8c1b299`.

Use it when discussing a finding in review, issues, or future override records.
The ID is derived from stable rule material, not from report order or timestamps.

## Evidence Snapshot

`Evidence Snapshot` is the recorded material used to derive the finding ID. It
includes stable fields such as rule ID, severity, path or line when present, and
normalized evidence label/value pairs.

It does not prove semantic correctness. It gives a maintainer or third party
enough deterministic material to understand why the finding fired and decide
whether the rule is useful or noisy for that repository.

## Policy Source

`Policy source` explains which policy Agent Gate used:

- `base branch`: Agent Gate loaded `agent-gate.yml` from the pull request base
  branch.
- `built-in default`: the default `agent-gate.yml` was confirmed absent, so
  Agent Gate used the policy bundled with the pinned Action version.
- `local fixture`: the report came from local CLI replay fixtures.

When JSON metadata shows `configSource: default`, the run used the built-in
default policy. That is expected for first installs that have not added
`agent-gate.yml` yet.

## What To Do First

1. Start with `mode: warn` and `fail-on-block: false`.
2. Read the job summary after each pull request run.
3. Treat `NEEDS HUMAN DECISION` as a review prompt, not a hard failure.
4. Add `agent-gate.yml` only after you know which signals are useful.
5. Promote rules to blocking only after warning-mode observation shows low
   noise.
