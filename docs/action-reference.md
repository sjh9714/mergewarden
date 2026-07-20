# GitHub Action Reference

## Inputs

| Input             | Default                   | Meaning                                         |
| ----------------- | ------------------------- | ----------------------------------------------- |
| `config`          | `mergewarden.yml`         | Policy path on the exact PR base commit         |
| `github-token`    | `${{ github.token }}`     | API-only PR read token                          |
| `mode`            | Policy value              | Optional `observe`, `warn`, or `block` override |
| `comment`         | `false`                   | Upsert the bounded PR report comment            |
| `fail-on-block`   | `true`                    | Fail a complete block decision                  |
| `report-json`     | `mergewarden-report.json` | JSON report path                                |
| `report-markdown` | `mergewarden-report.md`   | Markdown report path                            |

`fail-on-block` does not suppress an incomplete-analysis failure. Missing file
lists, unavailable required content, or exceeded analysis limits always fail.

## Outputs

| Output                                       | Meaning                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `decision`                                   | `pass`, `warn`, or `block`                                       |
| `status`                                     | `passed`, `observed`, `needs-review`, `blocked`, or `incomplete` |
| `analysis-complete`                          | `true` only when all required evidence was available             |
| `error-count`, `warning-count`, `info-count` | Active findings by severity                                      |
| `waived-count`                               | Auditable findings excluded by active base-policy waivers        |
| `expected-file-count`, `analyzed-file-count` | File-list completeness evidence                                  |
| `report-json`, `report-markdown`             | Report paths                                                     |
| `risk-score`                                 | Deprecated v0.x compatibility output                             |

The risk score is not calibrated and does not control the decision. Prefer
status and explicit counts. It is planned for removal in v1.

## Required Permissions

Basic analysis needs:

```yaml
permissions:
  contents: read
  pull-requests: read
```

`comment: true` also needs `issues: write`. Comment API failures remain
non-fatal, but MergeWarden only updates a marker-bearing comment owned by
`github-actions[bot]`. Discovery is bounded to the newest 100 comments; if no
owned marker appears there, MergeWarden creates a fresh managed comment.

## Packaging

The Action runs the committed Node 24 bundle. Root and package-local action
metadata are tested for structural equality. Neither entrypoint checks out the
target PR.

## GitHub API Reliability

Collection requests have a 30-second timeout and at most three attempts.
Network failures and HTTP 502/503/504 use 250 ms then 1 s backoff. HTTP 403/429
is retried only when GitHub identifies a rate limit; MergeWarden honors
`Retry-After` or the rate-limit reset time and allows at most 60 seconds of
additional waiting across the analysis. Fatal errors retain the HTTP status and
GitHub request ID. See GitHub's guidance on
[primary and secondary rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
