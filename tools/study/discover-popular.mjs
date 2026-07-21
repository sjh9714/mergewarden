// Popular-repo probe: issue search cannot filter by repo stars, so instead
// list recent closed PRs directly on popular repos (repo search DOES support
// stars:) and detect agent authorship locally. Appends to candidates.jsonl
// with cohort "popular:<signal>".
// Usage: node tools/study/discover-popular.mjs [maxRepos]

import { join } from "node:path";

import { DATA_DIR, SEARCH_SLEEP_MS } from "./config.mjs";
import { appendJsonl, ensureDataDir, ghApi, readJsonl, sleep } from "./lib.mjs";

const CANDIDATES = join(DATA_DIR, "candidates.jsonl");
const PROBED = join(DATA_DIR, "popular-probed.jsonl");

const AGENT_AUTHORS = new Map([
  ["devin-ai-integration[bot]", "devin"],
  ["copilot-swe-agent[bot]", "copilot"],
  ["cursor-com[bot]", "cursor"],
  ["codegen-sh[bot]", "codegen"],
]);

const BRANCH_PREFIXES = [
  ["codex/", "codex"],
  ["claude/", "claude-code"],
  ["cursor/", "cursor"],
  ["copilot/", "copilot"],
  ["devin/", "devin"],
];

const BODY_MARKERS = [
  ["Generated with Claude Code", "claude-code"],
  ["Co-Authored-By: Claude", "claude-code"],
  ["Generated with [Claude Code]", "claude-code"],
  ["Co-authored-by: Ona", "ona"],
];

function agentSignal(pr) {
  const author = pr.user?.login ?? "";
  if (AGENT_AUTHORS.has(author)) {
    return AGENT_AUTHORS.get(author);
  }

  const ref = pr.head?.ref ?? "";
  for (const [prefix, signal] of BRANCH_PREFIXES) {
    if (ref.startsWith(prefix)) {
      return signal;
    }
  }

  const body = pr.body ?? "";
  for (const [marker, signal] of BODY_MARKERS) {
    if (body.includes(marker)) {
      return signal;
    }
  }

  return null;
}

// Popular, recently active repos via repo search (stars: works there),
// sliced by star ranges to dodge the 1000-result cap.
async function popularRepos(maxRepos) {
  const slices = [
    "stars:>=50000",
    "stars:20000..49999",
    "stars:10000..19999",
    "stars:5000..9999",
    "stars:2000..4999",
  ];
  const repos = [];

  for (const slice of slices) {
    for (let page = 1; page <= 10; page += 1) {
      if (repos.length >= maxRepos) {
        return repos;
      }

      const result = await ghApi([
        "-X",
        "GET",
        "search/repositories",
        "-f",
        `q=${slice} pushed:>2026-06-15 archived:false`,
        "-f",
        "sort=updated",
        "-f",
        "per_page=100",
        "-f",
        `page=${page}`,
      ]);

      for (const item of result.items) {
        repos.push({ repo: item.full_name, stars: item.stargazers_count });
      }

      await sleep(SEARCH_SLEEP_MS);
      if (result.items.length < 100) {
        break;
      }
    }
  }

  return repos;
}

async function main() {
  ensureDataDir();
  const maxRepos = Number(process.argv[2] ?? 600);
  const probed = new Set(readJsonl(PROBED).map((p) => p.repo));
  const seen = new Set(readJsonl(CANDIDATES).map((c) => `${c.cohort}:${c.key}`));

  const repos = await popularRepos(maxRepos);
  process.stderr.write(`probing ${repos.length} popular repos (${probed.size} already done)\n`);

  let found = 0;
  let done = 0;

  for (const { repo, stars } of repos) {
    if (probed.has(repo)) {
      continue;
    }

    let pulls = [];
    try {
      pulls = await ghApi([
        "-X",
        "GET",
        `repos/${repo}/pulls`,
        "-f",
        "state=closed",
        "-f",
        "sort=updated",
        "-f",
        "direction=desc",
        "-f",
        "per_page=100",
      ]);
    } catch {
      appendJsonl(PROBED, { repo, stars, error: true });
      continue;
    }

    let hits = 0;
    for (const pr of pulls) {
      if (!pr.merged_at) {
        continue;
      }

      const signal = agentSignal(pr);
      if (!signal) {
        continue;
      }

      const cohort = `popular:${signal}`;
      const key = `${repo}#${pr.number}`;
      if (seen.has(`${cohort}:${key}`)) {
        continue;
      }

      seen.add(`${cohort}:${key}`);
      hits += 1;
      found += 1;
      appendJsonl(CANDIDATES, {
        cohort,
        key,
        repo,
        number: pr.number,
        author: pr.user?.login ?? null,
        created: pr.created_at,
        url: pr.html_url,
        title: pr.title,
        query: `popular-probe:${repo}`,
      });
    }

    appendJsonl(PROBED, { repo, stars, hits, checked: pulls.length });
    done += 1;
    if (done % 25 === 0) {
      process.stderr.write(`probed ${done} repos, agent PRs found: ${found}\n`);
    }

    await sleep(400);
  }

  process.stderr.write(`popular probe complete: ${found} agent PRs\n`);
}

await main();
