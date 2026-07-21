# Your First MergeWarden Report

Start in observe or warn mode. A finding is deterministic evidence to review,
not proof that a PR is unsafe.

## Status Labels

- `PASSED`: analysis completed without active warning/error findings.
- `OBSERVED FINDINGS`: observe mode found evidence while preserving a pass decision.
- `NEEDS REVIEW`: warn-mode evidence requires a human decision.
- `BLOCKED`: block-mode evidence rejected the change.
- `ANALYSIS INCOMPLETE`: required evidence was unavailable and the run failed.

## What to Read

1. Confirm `Analysis: complete` and compare expected/analyzed file counts.
2. Check policy source: exact base branch, built-in default, or local fixture.
3. Read the highest-severity active finding and its remediation.
4. Use the finding ID when discussing or waiving that exact evidence.
5. Inspect waived findings separately; they remain part of the audit record.

## Policy Source

- `base-branch`: config was loaded from the exact base SHA.
- `default`: the default path returned a confirmed 404, so bundled policy ran.
- `local`: the report came from replay fixtures.

Authentication, rate-limit, server, malformed-response, and missing custom-path
errors do not select the default policy.

## First Adoption

1. Use `mode: warn` and `fail-on-block: false`.
2. Review several representative PRs.
3. Tune individual checks rather than disabling the whole rule family.
4. Add only exact, expiring waivers to base policy.
5. Promote low-noise checks to block and require the status check.
