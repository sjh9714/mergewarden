// Phase 1: discover AI-agent-authored PRs via GitHub issue search.
// Usage: node tools/study/discover.mjs [cohortKey ...]
// Appends to tools/study/data/candidates.jsonl (resumable: already-seen
// cohort+key pairs are skipped, completed windows are recorded).

import { join } from "node:path";

import {
  COHORTS,
  DATA_DIR,
  END_DATE,
  MAX_LOOKBACK_DAYS,
  RAW_PER_COHORT,
  SEARCH_SLEEP_MS,
  WINDOW_DAYS,
} from "./config.mjs";
import {
  appendJsonl,
  ensureDataDir,
  ghApi,
  isoDaysBefore,
  readJsonl,
  repoFromRepositoryUrl,
  sleep,
} from "./lib.mjs";

const CANDIDATES = join(DATA_DIR, "candidates.jsonl");
const WINDOWS = join(DATA_DIR, "windows-done.jsonl");

async function searchPage(query, page) {
  return ghApi([
    "-X",
    "GET",
    "search/issues",
    "-f",
    `q=${query}`,
    "-f",
    "per_page=100",
    "-f",
    `page=${page}`,
    "-f",
    "advanced_search=true",
  ]);
}

async function main() {
  ensureDataDir();
  const only = process.argv.slice(2);
  const cohorts = only.length > 0 ? COHORTS.filter((c) => only.includes(c.key)) : COHORTS;
  const seen = new Set(readJsonl(CANDIDATES).map((c) => `${c.cohort}:${c.key}`));
  const doneWindows = new Set(readJsonl(WINDOWS).map((w) => `${w.cohort}:${w.start}`));
  const counts = new Map();
  for (const record of readJsonl(CANDIDATES)) {
    counts.set(record.cohort, (counts.get(record.cohort) ?? 0) + 1);
  }

  for (const cohort of cohorts) {
    let collected = counts.get(cohort.key) ?? 0;

    for (let offset = 0; offset < MAX_LOOKBACK_DAYS; offset += WINDOW_DAYS) {
      if (collected >= RAW_PER_COHORT) {
        break;
      }

      const end = isoDaysBefore(END_DATE, offset);
      const start = isoDaysBefore(END_DATE, offset + WINDOW_DAYS - 1);
      if (doneWindows.has(`${cohort.key}:${start}`)) {
        continue;
      }

      const query = `${cohort.base} created:${start}..${end}`;
      let total = null;

      for (let page = 1; page <= 10; page += 1) {
        const result = await searchPage(query, page);
        total = result.total_count;

        for (const item of result.items) {
          const repo = repoFromRepositoryUrl(item.repository_url);
          const key = `${repo}#${item.number}`;
          if (seen.has(`${cohort.key}:${key}`)) {
            continue;
          }

          seen.add(`${cohort.key}:${key}`);
          collected += 1;
          appendJsonl(CANDIDATES, {
            cohort: cohort.key,
            key,
            repo,
            number: item.number,
            author: item.user?.login ?? null,
            created: item.created_at,
            url: item.html_url,
            title: item.title,
            query,
          });
        }

        await sleep(SEARCH_SLEEP_MS);
        if (result.items.length < 100 || collected >= RAW_PER_COHORT) {
          break;
        }
      }

      appendJsonl(WINDOWS, { cohort: cohort.key, start, end, total });
      process.stderr.write(
        `${cohort.key} ${start}..${end}: total=${total} collected=${collected}\n`,
      );
    }
  }

  process.stderr.write("discovery complete\n");
}

await main();
