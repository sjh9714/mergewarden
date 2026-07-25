# MergeWarden Launch Kit

Reusable copy for launches and outreach. Do not publish any number that is not
reproduced by `tools/study/aggregate.mjs`. External publishing remains manual
and is done by the maintainer, not by automation.

Two standing rules, both learned the hard way:

- **Never ask for stars or upvotes.** Anywhere, in any wording.
- **Hacker News is blocked.** Two submissions were flagged/killed and three
  moderator emails went unanswered. Only a moderator can clear it. Do not
  resubmit; the Show HN copy below is kept only as source material for other
  channels.

## The one-command hook (use this everywhere)

Since v0.5.0 there is a single command that shows what the tool does, with no
token, no repository, and no network:

```bash
npx --yes mergewarden@0.6.0 demo
```

It analyzes an example pull request bundled inside the CLI **on the default
policy**, and reports 13 findings — contract scope, agent-control-plane drift,
workflow permission escalation, prompt injection into an agentic workflow, and
an added lifecycle script.

This replaces `npx mergewarden scan owner/repo#123` as the lead call to action
in every channel. The reason is conversion, not novelty: `scan` asks the reader
to go find a pull request first, and most real pull requests are clean, so the
likely first impression was an empty report. `demo` cannot be empty.

Keep `scan` as the _second_ line — it is what proves the tool works on real
data, and it is the natural next step once `demo` has shown the shape of the
output.

## Show HN (BLOCKED — source material only)

**Do not submit this.** Kept because the framing and the numbers are reused by
the other channels below.

Numbers below are from the combined 2026-07-20/21 runs (2,204 scanned, 2,191
complete analyses, including an 894-PR popular-repository probe with 856 PRs
on 10k+ star repositories); regenerate with `node tools/study/aggregate.mjs`
before publishing if the dataset changes.

Title options (pick one, max ~80 chars):

- Show HN: We scanned 2,204 merged AI-agent PRs – zero declared their intended scope
- Show HN: What 2,204 merged AI-agent PRs actually touched
- Show HN: Scanning 2,204 AI-agent PRs for scope escapes and privilege changes

Body draft:

> AI coding agents (Devin, Copilot coding agent, Codex, Claude Code, Cursor)
> now merge thousands of PRs a day. We scanned 2,204 recently merged
> agent-authored PRs — 894 of them on repositories with 200+ stars, 856 on
> 10k+ — with MergeWarden, a checkout-free policy gate, using its built-in
> default policy only.
>
> What we measured (deterministic evidence, no LLM judgment):
>
> - Of the 349 PRs that touched GitHub Actions workflows or package
>   manifests, 12.9% escalated workflow permissions and 17.5% introduced
>   unpinned actions.
> - 3.9% touched agent control-plane files (AGENTS.md, CLAUDE.md,
>   .mcp.json and similar) — the files that steer every future agent PR.
> - 7.0% had at least one boundary crossing of any kind.
> - 10k+ star repositories crossed a boundary at 4.3%, roughly half the
>   long-tail rate of 8.6% — established projects have guardrails; the long
>   tail is where agents run unfenced.
> - And 0 out of 2,204 declared a machine-readable scope for the change. Most
>   of those permission changes are probably intended. Nobody said so, so
>   nobody reviewing them can tell which.
>
> Methodology, caveats, and how to reproduce every number:
> [link to docs/study/methodology.md]. Findings are review evidence, not
> vulnerabilities; we publish aggregates only and name no repositories.
>
> MergeWarden is MIT-licensed, never executes PR code, and never calls an LLM
> at runtime. `npx --yes mergewarden demo` shows what it reports with no token
> and no repository; `npx mergewarden scan owner/repo#123` runs it against any
> public PR. I built it because agent PRs need a change-control layer, not
> another linter. Happy to answer anything about the data or the rules.

## Blog / DEV.to post outline

1. Hook: one real (anonymized) finding narrative.
2. The population problem: what agent PRs actually look like across GitHub
   (firehose sample) vs on popular repos (probe sample).
3. The numbers, with the honest denominators.
4. Why "declared scope" is the missing primitive; what a contract looks like.
5. Reproduce it: `npx mergewarden demo` then `npx mergewarden scan`, methodology
   link, open source.

## Community channels

- GeekNews (KR): 한국어 요약 + methodology 링크.
- r/devsecops, r/ExperiencedDevs (data discussion framing, not promotion).
- lobste.rs: `show` tag, same data framing.

## Awesome-list and directory submissions

| List                                      | Section                        | One-line entry                                                                                                       |
| ----------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| sindresorhus/awesome-actions              | Community Resources / Security | MergeWarden – checkout-free policy gate for AI-agent PRs: scope contracts, control-plane drift, privilege escalation |
| TaptuIT/awesome-devsecops                 | Code Review / Supply Chain     | MergeWarden – deterministic change-control gate for AI-generated pull requests                                       |
| e2b-dev/awesome-ai-agents (or equivalent) | Tooling / Safety               | MergeWarden – gates AI-agent PRs against declared scope and agent-control-plane drift                                |

PR body template: one sentence on what it is, MIT license, link to the study
page as evidence of usefulness. Follow each list's contributing guide; no
self-promotion language.

## Design-partner outreach template

Sent personally by the maintainer. One per repository, using rows from
`tools/study/data/outreach.csv` (internal file, never published).

> Subject: [repo] merged [X] AI-agent PRs recently — scan results attached
>
> Hi [name], I maintain MergeWarden (MIT, checkout-free gate for AI-agent
> PRs). While building a public study of agent-authored PRs I scanned [X]
> recent ones on [repo] with the default policy. [1-2 sentence summary of the
>
> > most interesting finding, framed as review evidence, not vulnerability].
>
> Full JSON reports attached — every finding replays locally with
> `npx mergewarden scan [repo]#[pr]`. If any of it is useful I'd love 15
> minutes of feedback on false-positive rates before I publish the aggregate
> study; happy to add a waiver config or tune paths for your layout either
> way. No action needed if not interesting.

Rules: never publish per-repo results without consent; if a finding looks
security-sensitive, follow the repository's security policy instead of a
public issue.

## Anticipated questions (any channel)

Answer honestly, concede limits fast, and link the methodology page. Never
argue tone; the data carries the post.

**"Isn't the demo cherry-picked to look bad?"**

> The example is deliberately composite, and yes, a single real PR rarely
> trips five rule families at once. What is not staged is the policy: `demo`
> runs the shipped default config, and a test enforces that, so its output is
> a claim about what you get with zero configuration. Point it at your own
> repository with `npx mergewarden scan owner/repo#123` — on a clean PR it
> reports nothing, which is the honest outcome.

**"Your own tool missed a default for months — why trust the rules?"**

> Fair, and it happened twice. v0.5.0 fixed agent detection defaults that were
> empty arrays, and v0.5.1 fixed a Claude Code body marker that matched 0 of 13
> real pull requests because the product name sits inside a Markdown link. Both
> were found by re-running the scan study against its own stored data, both are
> written up in the changelog with the measurements, and both now have tests
> pinned to verbatim real-world output. The rules that were never gated on
> detection — workflow permissions, control-plane drift — were verified
> unaffected on 66 of 66 re-scanned PRs.

**"What's the false-positive rate?"**

> Findings are boundary evidence, not verdicts, so "false positive" means
> "boundary crossing a maintainer considers fine," and that is repo-specific.
> That is exactly why findings are tunable per check and waivable per finding
> ID from the base branch. Measured precision against maintainer judgment is
> the top item on the roadmap; that's what the design-partner phase is for.

**"How is this different from zizmor?"**

> zizmor lints workflow files for misconfigurations — it is excellent and we
> recommend it. MergeWarden is differential change control for a PR: did this
> change escalate permissions, leave declared scope, or modify the files that
> steer future agents (AGENTS.md, .mcp.json). It reports what the PR changed,
> not what was already true. Use both.

**"Why no LLM at analysis time?"**

> The gate's job is to be deterministic and replayable: same PR, same policy,
> same finding IDs — that is what lets a finding be waived by exact identity
> and re-verified locally. LLM review is complementary judgment on top; an
> untrusted PR prompting the judge that gates it is also an injection surface
> we deliberately avoid.

**"0 of 2,204 declared scope — isn't that because no tool asks them to?"**

> Yes, exactly. The number is not an indictment of agents; it shows the
> primitive is missing. Agent vendors emit rich task context today and none
> of it survives into the PR as a machine-checkable declaration. The contract
> block is one concrete proposal for where that could live.

**"Your sample is biased / branch heuristics are noisy."**

> Correct on both counts, and the methodology page says so: cohort
> attribution is heuristic, the firehose skews to small repos (that is the
> population), and the popular-repo probe exists because issue search cannot
> filter by stars. Every query and window is published; rerun them and the
> numbers reproduce.

**"Scanning other people's PRs is creepy."**

> Everything scanned is public metadata read through the GitHub API — the
> same data any reviewer sees. We publish aggregates only, name no
> repositories, and the per-repo results went only to those maintainers
> privately.

## GeekNews post (KR, ready to submit)

Title: 머지된 AI 에이전트 PR 2,204개를 스캔해보니 — 작업 범위를 선언한 PR은 0개

> Devin, Copilot 코딩 에이전트, Codex, Claude Code, Cursor가 여는 PR을
> 2,204개 스캔했습니다(체크아웃 없이 GitHub API만 사용, LLM 미사용,
> 결정적 분석).
>
> 워크플로나 패키지 매니페스트를 건드린 349개 중 **12.9%가 워크플로 권한을
> 상승**시켰고 **17.5%가 핀 안 된 액션**을 추가했습니다. AGENTS.md, .mcp.json
> 처럼 "앞으로의 모든 에이전트 실행을 조종하는 파일"을 건드린 PR도 3.9%.
> 10k+ 스타 저장소의 경계 위반율(4.3%)은 롱테일(8.6%)의 절반 수준이었습니다.
>
> 그리고 **2,204개 중 자기가 뭘 바꾸려는지 기계가 검증할 수 있는 형태로
> 선언한 PR은 0개**였습니다. 저 권한 변경들은 아마 대부분 의도된 것일 겁니다.
> 다만 아무도 선언하지 않았으니, 리뷰하는 쪽에서 어느 게 의도된 건지 구분할
> 방법이 없습니다.
>
> 방법론과 쿼리 전문은 공개되어 있고 전부 재현 가능합니다:
> https://github.com/sjh9714/mergewarden/blob/main/docs/study/methodology.md
>
> 스캔에 쓴 도구는 MergeWarden(MIT)입니다. 토큰도 저장소도 없이 한 줄로
> 뭘 잡는지 볼 수 있습니다:
>
> ```
> npx --yes mergewarden demo
> ```
>
> 실제 공개 PR에 돌려보려면 `npx mergewarden scan owner/repo#123`.

## Reddit copy (r/devops, r/ExperiencedDevs — discussion framing)

Title: We scanned 2,204 merged AI-agent PRs. Zero declared what they intended
to change.

> Data from a study I ran, not a product pitch (tool is MIT, methodology
> fully published). We scanned 2,204 recently merged PRs authored by coding
> agents (Devin, Copilot coding agent, Codex, Claude Code, Cursor) on public
> repos with a deterministic, checkout-free policy engine.
>
> - 12.9% of workflow-touching agent PRs escalated workflow permissions;
>   17.5% added unpinned actions.
> - 3.9% edited agent instruction files (AGENTS.md, .mcp.json) — the files
>   that steer every future agent PR.
> - 10k+ star repos crossed a boundary at roughly half the long-tail rate.
> - 0 of 2,204 declared a machine-readable scope for the change. Most of those
>   permission changes are probably intended — but nobody said so, so a
>   reviewer can't tell which.
>
> Full write-up and reproducible queries:
> https://github.com/sjh9714/mergewarden/blob/main/docs/study/what-2204-agent-prs-showed.md
> (`npx --yes mergewarden demo` shows what the scanner reports, no token needed.)
>
> Curious how other teams are reviewing agent PRs — is anyone requiring
> declared scope, or is diff review still the whole story?

## X/Twitter thread copy

1/ We scanned 2,204 merged AI-agent PRs (Devin, Copilot, Codex, Claude Code,
Cursor) on public GitHub repos. Zero — 0 of 2,204 — declared what they
intended to change in any machine-checkable form.

2/ Of the 349 that touched CI workflows or package manifests: 12.9%
escalated workflow permissions, 17.5% introduced unpinned actions. Most are
probably benign. Nobody declared them, so nobody can tell.

3/ 3.9% edited agent control-plane files (AGENTS.md, .mcp.json) — the files
that steer every FUTURE agent PR. An agent editing its own instructions is a
quiet privilege-escalation path.

4/ 10k+ star repos crossed a boundary at 4.3%. The long tail: 8.6%. Guardrails
exist where reviewers are strongest — and agents run loosest where oversight
is weakest.

5/ Every number reproduces from published queries. Write-up:
https://github.com/sjh9714/mergewarden/blob/main/docs/study/what-2204-agent-prs-showed.md

6/ The scanner is MIT and you can see exactly what it reports in one command —
no token, no repo, no signup:

npx --yes mergewarden demo

## Product Hunt launch day (scheduled Tue 2026-07-28)

Launch goes live 2026-07-28 at 12:01am PT (4:01pm KST) for 24 hours. Name,
tagline, gallery, logo and description are set and scheduled. Goal for the day:
genuine first-hour engagement. No upvote-begging, no cold DMs, no upvote
services — Product Hunt removes launches for that.

Done already: the description now leads with `npx mergewarden demo` (488/500
chars), and pricing is marked Free.

### Maker's first comment (post immediately after the launch goes live)

There is **no field for this in the launch editor** — it is posted by hand as
the first comment on the live page, so it has to be ready to paste. It is the
most-read text of the launch after the tagline.

> Hi Product Hunt 👋 I built MergeWarden.
>
> Coding agents open pull requests all day now. The review process for them is
> still a human reading a diff and hoping to notice the one file that didn't
> belong.
>
> Before building anything I wanted to know whether that was a real problem, so
> I scanned 2,204 recently merged agent-authored PRs (Devin, Copilot coding
> agent, Codex, Claude Code, Cursor) on public repos. Of the 349 that touched CI
> workflows or package manifests, 12.9% escalated workflow permissions and 17.5%
> added unpinned actions. 3.9% edited the agent instruction files — AGENTS.md,
> CLAUDE.md, .mcp.json — that steer every future agent run in that repo.
>
> Most of those are probably intended. That's the actual problem: 0 of 2,204
> declared what they meant to change, so a reviewer has no way to tell which.
>
> MergeWarden is the gate for that. It checks whether a PR stayed inside the
> scope it declared, whether it touched the agent control plane, and whether it
> wired untrusted text into an agentic workflow's prompt. It never checks out or
> executes PR code, never reads its policy from the PR's own branch, and never
> calls an LLM — so every finding is deterministic and replays locally.
>
> You can see exactly what it reports in one command. No token, no repo, no
> signup:
>
> npx --yes mergewarden demo
>
> Honest limits: findings are review evidence, not verdicts, and "false
> positive" here means "a boundary your team decided was fine" — which is why
> every check is tunable and every finding waivable by ID. Agent detection is a
> heuristic, not proof of authorship. And it doesn't judge code quality at all.
>
> The question I'd genuinely like answered: how is your team reviewing
> agent-opened PRs today? Is anyone asking agents to declare scope up front, or
> is reading the diff still the whole process? MIT, and I'll be here all day.

Trim if PH truncates; the first three paragraphs and the `demo` command are the
part that must survive.

### If the launch does not go well

Rank is mostly out of our control and PH traffic is not the point — the point is
that anyone who arrives can see the tool do something in one command. Record
what happened, keep the comment thread answered, and move on to the channels
below. Do not extend the launch by asking people for support.

### The morning it goes live (do these, in order)

1. Open the PH launch page and confirm it's live on the homepage.
2. Post the maker's first comment below. It is the highest-value single action
   of the day and there is no field for it in the launch editor.
3. Post the GitHub Discussion note below (Announcements category) so repo
   visitors see it.
4. Reply to every PH comment within the hour, all day. Speed of maker replies
   is the single biggest lever on ranking.
5. If anyone who already engaged (ecogetaway, microcks, the two contributors)
   is on PH, a genuine heads-up is fine — but never "please upvote."
6. Optional, low value: the X post below. See the note on it first.

### What has actually worked, and what has not

Worth reading before deciding where to spend launch day, because the evidence is
one-sided.

**Broadcast channels have rejected this project four times.** Show HN flagged and
killed twice with three unanswered moderator emails; an r/ClaudeAI post removed;
and on 2026-07-25 the X account was automatically suspended for "inauthentic
behaviors" and restored two hours later on appeal with no violation found. The
common factor is a low-history account posting promotional content — which is
what every one of those attempts was.

**Participation channels have produced everything the project has.** Both
external contributors came from good-first-issue aggregators. The
`oss-ai-contribution-policy` maintainer relationship and the September pilot came
from answering a schema question with data. A CNCF org contributor adopted our
pull-request template wording verbatim after we read their draft and commented on
it. Every one of those started by being useful inside someone else's thread.

Plan accordingly: Product Hunt is a one-day broadcast and should be treated as
such. The durable work after it is participation.

### X post (launch morning) — optional, and read this first

**The account has 0 followers**, joined February 2026, and has 14 posts, none
about developer tooling. Organic reach is approximately zero, so this is not a
distribution channel — at most it is a link that exists if someone looks for it.

**It was auto-suspended on 2026-07-25 for "inauthentic behaviors"** and restored
the same day on appeal. Posting a promotional link with a URL from a
freshly-restored, low-history account is exactly the shape that triggered it. The
downside of a second suspension is worse than the upside of a post nobody sees.

If posting anyway: post it as a plain note, no thread, no hashtags, no repeated
posting through the day, and do not delete-and-repost if engagement is low.

> MergeWarden is live on Product Hunt today 🚀
>
> It's the checkout-free gate for AI-agent PRs — declared scope,
> agent-control-plane drift (AGENTS.md/.mcp.json), workflow permission
> escalation, prompt injection into agentic workflows. No checkout, no LLM.
>
> See exactly what it catches, no token or repo needed:
>
> npx --yes mergewarden demo
>
> Built after scanning 2,204 merged agent PRs: 0 declared their scope.
>
> https://www.producthunt.com/products/mergewarden?launch=mergewarden

### GitHub note (post as a Discussion on launch morning)

Repository Discussions are enabled; use the **Announcements** category.

> MergeWarden is on Product Hunt today. If the tool or the 2,204-PR study has
> been useful, a look and any honest feedback there means a lot — link:
> https://www.producthunt.com/products/mergewarden?launch=mergewarden
>
> If you have never run it: `npx --yes mergewarden demo` shows what it reports
> on an example PR, with no token and no repository.
>
> Not asking for anything beyond genuine thoughts; happy to answer questions
> about the detection rules or the data.

### Do NOT

- Ask for upvotes anywhere (PH, X, GitHub, DMs).
- Use upvote groups / star-for-star / bought stars — ToS violation and it
  ironically contradicts what this tool stands for.
- Cold-DM strangers. Share where your genuine audience already is.

### After the 24 hours

Record the result (rank, upvotes, comments, stars gained) and fold the best
questions from the thread into the docs FAQ.
