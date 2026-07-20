// Phase 1b: hydrate repository stars/metadata via GraphQL, then build the
// scan target list. Writes repos.json and targets.jsonl.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR, PER_REPO_CAP, STAR_MIN, TARGET_MAX } from "./config.mjs";
import { appendJsonl, ensureDataDir, ghApi, readJsonl, sleep } from "./lib.mjs";

const CANDIDATES = join(DATA_DIR, "candidates.jsonl");
const REPOS = join(DATA_DIR, "repos.json");
const TARGETS = join(DATA_DIR, "targets.jsonl");

function alias(index) {
  return `r${index}`;
}

async function hydrate(repos) {
  const result = {};

  for (let start = 0; start < repos.length; start += 100) {
    const batch = repos.slice(start, start + 100);
    const parts = batch.map((repo, index) => {
      const [owner, name] = repo.split("/");
      const escapedOwner = JSON.stringify(owner);
      const escapedName = JSON.stringify(name);
      return `${alias(index)}: repository(owner: ${escapedOwner}, name: ${escapedName}) { stargazerCount isArchived pushedAt primaryLanguage { name } }`;
    });
    const query = `query { ${parts.join(" ")} }`;
    let data;
    try {
      data = await ghApi(["graphql", "-f", `query=${query}`]);
    } catch (error) {
      // Batches with deleted/renamed repos return errors alongside data; gh
      // exits non-zero. Parse what we can from stdout if present.
      const stdout = error.stdout ?? "";
      try {
        data = JSON.parse(stdout);
      } catch {
        process.stderr.write(`graphql batch failed at ${start}; skipping\n`);
        continue;
      }
    }

    for (const [index, repo] of batch.entries()) {
      const node = data?.data?.[alias(index)];
      if (node) {
        result[repo] = {
          stars: node.stargazerCount,
          archived: node.isArchived,
          pushedAt: node.pushedAt,
          language: node.primaryLanguage?.name ?? null,
        };
      }
    }

    process.stderr.write(`hydrated ${Math.min(start + 100, repos.length)}/${repos.length}\n`);
    await sleep(1_000);
  }

  return result;
}

function buildTargets(candidates, repoInfo) {
  // Dedupe PRs that matched multiple cohorts; keep every matching signal.
  const byKey = new Map();
  for (const candidate of candidates) {
    const existing = byKey.get(candidate.key);
    if (existing) {
      if (!existing.cohorts.includes(candidate.cohort)) {
        existing.cohorts.push(candidate.cohort);
      }
    } else {
      byKey.set(candidate.key, { ...candidate, cohorts: [candidate.cohort] });
    }
  }

  const eligible = [...byKey.values()].filter((candidate) => {
    const info = repoInfo[candidate.repo];
    return info && !info.archived && info.stars >= STAR_MIN;
  });

  // Newest first, then cap per repo so single repos cannot dominate.
  eligible.sort((a, b) => (a.created < b.created ? 1 : -1));
  const perRepo = new Map();
  const targets = [];

  for (const candidate of eligible) {
    const used = perRepo.get(candidate.repo) ?? 0;
    if (used >= PER_REPO_CAP || targets.length >= TARGET_MAX) {
      continue;
    }

    perRepo.set(candidate.repo, used + 1);
    targets.push({
      key: candidate.key,
      repo: candidate.repo,
      number: candidate.number,
      cohorts: candidate.cohorts,
      author: candidate.author,
      created: candidate.created,
      url: candidate.url,
      stars: repoInfo[candidate.repo].stars,
      language: repoInfo[candidate.repo].language,
    });
  }

  return targets;
}

async function main() {
  ensureDataDir();
  const candidates = readJsonl(CANDIDATES);
  const repos = [...new Set(candidates.map((c) => c.repo))];
  process.stderr.write(`candidates=${candidates.length} unique repos=${repos.length}\n`);

  const repoInfo = await hydrate(repos);
  writeFileSync(REPOS, JSON.stringify(repoInfo, null, 2));

  const targets = buildTargets(candidates, repoInfo);
  writeFileSync(TARGETS, "");
  for (const target of targets) {
    appendJsonl(TARGETS, target);
  }

  process.stderr.write(
    `targets=${targets.length} across ${new Set(targets.map((t) => t.repo)).size} repos\n`,
  );
}

await main();
