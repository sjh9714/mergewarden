# What Pull Request Caps Reach

**Measured 2026-07-30.**

On [2026-06-17](https://github.blog/changelog/2026-06-17-limit-open-pull-requests-for-users-without-write-access/)
GitHub shipped a cap on how many pull requests a user without write access can have open at once.
It is the control maintainers had been asking for since 2016, and it arrived aimed at AI
submission volume.

So: how much of a real queue does it reach?

## Caps are built for concentration. These queues are dispersed.

Open pull requests from authors without write access, bots excluded, and how many a cap of three
would have deferred:

| Repository                            | open PRs | distinct authors | deferred by a cap of 3 |
| ------------------------------------- | -------: | ---------------: | ---------------------: |
| `huggingface/transformers`            |       55 |               49 |                  **1** |
| `typescript-eslint/typescript-eslint` |       28 |               24 |                  **1** |
| `DIYgod/RSSHub`                       |       26 |               23 |                  **1** |
| `django/django`                       |       79 |               59 |                      7 |
| `caddyserver/caddy`                   |       58 |               43 |                      7 |
| `coollabsio/coolify`                  |       86 |               68 |                     11 |

**Between 2% and 13%.** Fifty-five pull requests arriving from forty-nine different people is not
a spam pattern, and a per-person limit is the wrong shape of instrument for it. The cap works
against one contributor opening thirty; what these queues contain is thirty contributors opening
one each.

That is not an argument against the feature. It closes a real hole, and the repositories where
one account floods a queue are exactly the ones that could not defend themselves before. It is
an argument about what is left afterwards: **the volume that reaches a reviewer is barely
changed, so deciding what to read first is still the work.**

## Maintainers are not closing the door either

GitHub also shipped a setting for who may open a pull request at all. Across the 30 repositories
in the anti-slop adopter cohort that have a live queue — projects that had already decided the
problem was real enough to install an auto-closing action — **every one reports
`pull_request_creation_policy: "all"`.**

That is the default, so this mostly measures that nobody changed it. Still: the population most
motivated to restrict contributions has not restricted them. They installed a filter and kept
the door open.

## Limits

- **A cap of three is an assumption.** The threshold is per repository; a stricter cap defers
  more. The dispersion is the finding, not the specific percentage.
- **Only open queues were read.** A cap also changes what is submitted, and no snapshot can see
  a pull request that was never opened because someone hit a limit.
- `pull_request_creation_policy` is the February 2026 creation setting. The June concurrent-PR
  limit does not appear in the repository API, so its adoption is not measured here.
- Queues move. Every figure is a snapshot taken on one day.

Reproduce from each repository's public pull request list: group open pull requests by author,
excluding bots and anyone with `MEMBER`, `OWNER` or `COLLABORATOR` association, and count how
many exceed the cap.
