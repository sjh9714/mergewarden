# What AI Disclosure Actually Looks Like

**Measured 2026-07-30 across 1,029 repositories, from git history rather than the GitHub API.**

The [2,204-PR scan](methodology.md) headline was that **0 of 2,204** merged agent pull requests
declared their intended scope. That number is correct and it is also incomplete: it measures one
convention, the pull-request contract, that nobody has adopted. While we were counting its
absence, a different disclosure was being written into the same repositories, automatically, by
the tools themselves.

```
Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>
Co-authored-by: Cursor Agent <cursoragent@cursor.com>
Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>
```

Nobody opts in. The tool writes it, it survives a squash merge, and it lands in permanent
history, unlike a `codex/**` branch name, which disappears the moment the branch is deleted or
renamed. It also carries the model, which is the granularity Mesa's policy asks for and which
nothing else in the ecosystem supplies.

## What we measured

Two samples, both read from cloned git history (`--bare --filter=tree:0`), so no API and no
sampling by search relevance:

- **674 repositories** from the 2,204-PR corpus. Biased by construction (every one of them had
  at least one agent pull request), so it is used only for discovering address formats.
- **355 repositories**: the top 45 by stars in each of C, C++, Rust, Go, Python, TypeScript,
  JavaScript and Java. This is the sample every rate below comes from.

Counts were checked three ways on `ghostty-org/ghostty`: `git log | grep` gives 50, the GitHub
commit-search API gives 50, and the study script gives 50.

## Seven addresses, and two that look like tools but are not

Of 124 distinct co-author addresses, seven could be attributed to a tool with certainty:

| Address                                                   | Tool           | Commits observed |
| --------------------------------------------------------- | -------------- | ---------------- |
| `noreply@anthropic.com`                                   | Claude Code    | 198,954          |
| `<id>+copilot@users.noreply.github.com`                   | GitHub Copilot | 38,530           |
| `cursoragent@cursor.com`                                  | Cursor         | 17,174           |
| `<id>+devin-ai-integration[bot]@users.noreply.github.com` | Devin          | 7,577            |
| `copilot@github.com`                                      | GitHub Copilot | 2,189            |
| `codex@openai.com`                                        | Codex          | 1,295            |
| `<id>+google-labs-jules[bot]@users.noreply.github.com`    | Google Jules   | 201              |

**`mdangelo@openai.com` and `etraut@openai.com` are also in this data, and they are people who
work at OpenAI.** Matching on the domain (which our first pass did) reports human co-authors
as AI. Matching on the display name is worse: the same tool writes `Claude`, `Claude Opus 4.8`
and `Claude Opus 4.8 (1M context)`, and a person can type any of them. Only the exact address,
or a numeric GitHub no-reply prefix bound to a specific bot login, is safe.

## The rate is decided by language, not by policy

Commit-weighted rates are useless here. C++ looks like 19.5% of recent commits, but
`ClickHouse/ClickHouse` alone contributes 7,462 of C++'s 7,732 AI-trailered commits, and the
median C++ repository in the sample is at zero. Repository-level medians, over the three months
to 2026-07:

| Language   | Median |     | Language | Median |
| ---------- | ------ | --- | -------- | ------ |
| JavaScript | 7.6%   |     | Rust     | 1.5%   |
| Python     | 6.3%   |     | Java     | 0.5%   |
| TypeScript | 5.5%   |     | C        | 0.0%   |
| Go         | 1.5%   |     | C++      | 0.0%   |

## Correction: we said bans work, and the data does not support it

An earlier pass of this measurement compared hand-picked policy repositories and found that
projects banning AI contribution (curl, Godot, servo, QEMU, FreeBSD) showed **0%** while
permissive ones showed up to 16.6%. That looked like strong evidence that policy changes
behaviour.

It was confounded. Every repository in that list is a C or C++ project, and **the median C/C++
repository is at 0% regardless of policy.** Stratifying by language on the balanced sample:

|                                                 | n   | median   |
| ----------------------------------------------- | --- | -------- |
| Repositories whose docs mention AI contribution | 88  | **1.7%** |
| Repositories whose docs do not                  | 145 | **1.0%** |

No effect, and if anything the sign is backwards: JavaScript (+5.3pp) and TypeScript (+5.7pp)
both show _higher_ rates among repositories with a policy. The plausible reading is reverse
causation: projects write an AI policy after they start receiving AI contributions.

We are not claiming the null either. Policy status cannot be decided by keyword matching, which
is what that table rests on, and the errors run both ways (see below).

## Almost nobody actually bans it

Across the 355 top repositories, keyword matching flagged 21 as restrictive. Reading the text
of the strongest candidates by hand:

**Genuine prohibitions on AI-written code: three.**
`nothings/stb` ("AI AND LLM ARE FORBIDDEN"), `pocketbase` (pull requests disabled outright after
LLM spam), `TeamNewPipe/NewPipe` ("generally prohibited … usually lacking a fundamental
understanding").

**Prohibitions on AI-written _prose_, with code untouched: three.** `syncthing` ("Do not submit
AI generated issues or comments"), `LizardByte/Sunshine` (AI-generated PR summaries that replace
the template), `anomalyco/opencode` ("Long, AI-generated PR descriptions and issues are not
acceptable"). This is the same artifact-versus-conversation split llama.cpp drew, arrived at
independently, and we have not seen it named as a category anywhere.

**Not prohibitions at all: four.** `home-assistant/core` ("We support using AI (i.e., LLMs) as
tools when contributing"), `go-gitea/gitea` ("Contributions made with the assistance of AI tools
are welcome"), `caddyserver/caddy` ("The use of LLMs is allowed"), `pola-rs/polars` ("All AI
usage in any form must be disclosed"). Keyword matching mistook conditional language for
prohibition.

So the argument the ecosystem is having about banning AI contribution concerns a rule that
**three of the 355 most popular repositories on GitHub actually have.**

## What policies ask for instead

Comprehension. Four projects, independently, in almost the same words:

> `home-assistant/core`: "you are responsible for any contributions you submit … AI-generated
> content that you have not personally reviewed and understood"
>
> `go-gitea/gitea`: "Only use AI to assist in contributions that you understand well enough to
> explain, defend"
>
> `caddyserver/caddy`: "You certify that you wrote and comprehend the code you submit"
>
> `starship/starship`: "You must be able to explain what your changes do … read and understood
> every line of code you submit"

**No checker can verify that, including this one.** In our
[clause survey](https://github.com/ecogetaway/oss-ai-contribution-policy/issues/22) it is
bucket 3: unenforceable in principle. Saying so is more useful than pretending otherwise.

The half that _is_ checkable is disclosure. `starship` requires contributors to "state the tool
you used"; `polars` requires that "all AI usage in any form must be disclosed". That is a
trailer check on commit metadata, and the trailer these tools already write is the disclosure
those policies are asking for.

## A disclosure field is necessary and nowhere near sufficient

Measured 2026-07-30 over the 30 most recently updated open pull requests of each repository,
excluding `dependabot[bot]`, `renovate[bot]` and `github-actions[bot]`. Three signals, counted
separately: a `Co-authored-by:` trailer written by a tool, a disclosure field from the
repository's pull-request template kept in the body, and a disclosure written in prose.

**What this population is.** Repositories were found by code search for a disclosure field in
`pull_request_template.md`, plus projects already known to have a written AI policy. It is not a
sample of the [OSS AI-contribution policy catalogue](https://github.com/ecogetaway/oss-ai-contribution-policy):
of the eighteen repositories measured here, **two (`ghostty-org/ghostty` and `llvm/llvm-project`)
are catalogued.** Nor is it a sample of contributions: **open pull requests are a queue, not
merged work**, and a queue over-represents whatever has not been dealt with yet.

Ten repositories ship a disclosure field. **Retention ranges from 0% to 83%.**

| Repository                          | field                                    | pulls |   kept | trailer | prose |
| ----------------------------------- | ---------------------------------------- | ----: | -----: | ------: | ----: |
| `OWASP/threat-dragon`               | checklist, tool + model                  |     4 |  **4** |       0 |     0 |
| `django/django`                     | `## AI Assistance Disclosure (REQUIRED)` |    30 | **25** |       1 |     4 |
| `caddyserver/caddy`                 | `## Assistance Disclosure`               |    30 | **24** |       2 |    12 |
| `external-secrets/external-secrets` | `## AI Assistance disclosure`            |    29 | **21** |       3 |    16 |
| `blakeblackshear/frigate`           | `## AI disclosure`                       |     3 |      2 |       0 |     1 |
| `starship/starship`                 | `#### AI-Assistance`                     |    28 |     14 |       0 |    14 |
| `argotorg/solidity`                 | `## AI Disclosure`                       |    30 |      8 |       1 |     0 |
| `ChainSafe/lodestar`                | checklist                                |    28 |      1 |      15 |    19 |
| `certbot/certbot`                   | `## AI Assistance Disclosure`            |    30 |  **0** |       1 |     8 |
| `elk-zone/elk`                      | checklist                                |    29 |  **0** |       0 |     1 |

And ten without one, where disclosure arrives only when a tool volunteers a trailer or a
contributor writes a sentence: `home-assistant/core` 11 of 28 by trailer, `biomejs/biome` 10 of
28, `go-gitea/gitea` 7 of 30, `llvm/llvm-project` 4 of 30, `ghostty-org/ghostty` 5 of 30,
`pola-rs/polars`, `denoland/deno` and `ggml-org/llama.cpp` at 1 of 30 each.

**The field is what makes disclosure possible; it is not what makes it happen.** Certbot has a
heading, has a fallback line reading `_This PR is missing an AI assistance disclosure._` for the
case where nobody fills it in, and gets **0 of 30**; its contributors write pull request bodies
from scratch (`Fixes #10736. ## Problem …`) rather than editing the template. Django, whose
heading carries `(REQUIRED)`, gets 25 of 30. Something between those two decides the outcome and
this measurement does not isolate it.

### The trailer column is about one vendor's default, not about projects

Home Assistant reaches 11 of 28 by trailer without asking anyone. It is tempting to read that as
a symmetry (field here, trailer there), and the first version of this page did. It is not one.
**Claude Code writes that trailer by default**, so the trailer column tracks which tool a
repository's contributors happen to use, and whether they left the default on. A project whose
contributors use a tool that writes no trailer scores zero without having chosen anything.

Only the other half of the claim survives that, and it survives on its own:
**where a project provides a place to disclose, contributors use it.**

### Two corrections, both caught before use

**Threat Dragon first scored 0 of 4 and was reported as having no disclosure field.** It has
one, asking for tool _and_ model version with an explicit "no AI" option, more than most in
this table. The detector matched Markdown headings only, so a field offered as a checklist item
was invisible. Found by reading the template while drafting a comment that would have told the
project it lacked something it had built better than the examples being cited at it.

**The first version of this section claimed a field in the template is the mechanism that
works**, on a sample of three that happened to all be high. Widening to ten found certbot and
elk at zero. The claim did not survive its own sample being enlarged.

Also worth knowing: open queues move. Home Assistant read 19 of 30 earlier the same day and 11
of 28 an hour later, on a different set of open pull requests. Every figure here is a snapshot.

### Five conventions, and a checker written for one reads the others as silence

Fedora requires `Assisted-by:`; Kubernetes forbids it; Mesa requires `Generated-by:` with tool
and optional model; ten projects here want a field in the template; everywhere else it is
whatever the tool happened to write. A schema that asks projects to declare an AI policy cannot
assume where disclosure lives; it has to let a project say which convention it uses.

### Retention is not disclosure, and the gap is half

`kept` counts a field **retained**, not filled. Caddy retains its `## Assistance Disclosure`
section in 24 of 30 pull requests, and **12 of those carry an actual statement.**

That gap is probably the more useful finding on this page. Prescribing a format buys retention;
only half of the retention converts into someone saying anything. A project that adds a field
and then reads its retention rate as a compliance rate will be measuring the template, not the
disclosure: **the shape may be relocating the problem rather than solving it.**

The prose count is deliberately narrow: a body mentioning "AI" is not a disclosure.

Reproduce with `node tools/study/disclosure-conventions.mjs <owner/repo> [...]`.

## Limits

- **The sample is the top 45 repositories per language.** Popular projects, not open source.
- **Only seven tools are identifiable.** A tool that writes no trailer, or a contributor who
  turns the trailer off, is invisible. This repository disables it, so this repository would
  measure as 0%.
- **Zero trailers is not zero AI.** It means no AI disclosed _this way_, and conventions
  differ by project. gitea's contributors disclose through commit trailers: 7 of its 30 most
  recently updated open pull requests carry one. starship requires disclosure just as
  explicitly, has zero trailers across the same window, and gets it instead through an
  `#### AI-Assistance` section in its pull-request template, which contributors fill in. A
  trailer count measures one convention, not compliance.
- **Commit-unit counting interacts with merge strategy.** A squashing project records one
  trailered commit per pull request; a merging project records several.
- **Policy classification is keyword-based** except where quoted above, and it is wrong in both
  directions: `curl` has a policy and landed in the no-policy group, because its contributing
  documentation lives outside the repository. Repositories whose `CONTRIBUTING.md` is only a
  pointer elsewhere were excluded rather than counted as policy-free.

## Prior work

The overall trajectory of AI-assisted commits is not our finding and is measured far better
elsewhere: [Coding Beyond Your Training](https://arxiv.org/html/2605.25438v1) (May 2026)
harvests 7,786,771 Claude-co-authored commits across 185,517 authors. What is ours is the
narrower question (what the trailers say about _policies_) and the address-level
identification needed to count them without misattributing human co-authors.
