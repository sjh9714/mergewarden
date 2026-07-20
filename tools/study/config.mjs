// Shared configuration for the AI-agent PR scan study.
// Data files live in tools/study/data/ and are gitignored.

export const DATA_DIR = new URL("./data/", import.meta.url).pathname;

// Each cohort is one way of finding AI-agent-authored PRs. `base` is the
// GitHub issue-search query without the created: window. Precision notes:
// author cohorts are exact; head/body cohorts are heuristics and get a manual
// spot-check before the full run.
export const COHORTS = [
  {
    key: "devin",
    base: "is:pr is:merged author:devin-ai-integration[bot]",
  },
  {
    key: "copilot",
    base: "is:pr is:merged author:copilot-swe-agent[bot]",
  },
  {
    key: "codex",
    base: "is:pr is:merged head:codex -author:app/dependabot -author:app/renovate",
  },
  {
    key: "claude-code",
    base: 'is:pr is:merged "Generated with Claude Code" in:body -author:app/dependabot -author:app/renovate',
  },
  {
    key: "cursor",
    base: "is:pr is:merged head:cursor -author:app/dependabot -author:app/renovate",
  },
];

// Discovery window: walk backward from END_DATE in WINDOW_DAYS slices until
// MAX_LOOKBACK_DAYS or RAW_PER_COHORT candidates.
export const END_DATE = process.env.STUDY_END_DATE ?? "2026-07-19";
export const WINDOW_DAYS = 2;
export const MAX_LOOKBACK_DAYS = Number(process.env.STUDY_LOOKBACK_DAYS ?? 90);
export const RAW_PER_COHORT = Number(process.env.STUDY_RAW_PER_COHORT ?? 600);

// Search API pacing: 30 requests/minute shared budget.
export const SEARCH_SLEEP_MS = 2_200;

// Target selection. The recent-PR firehose is dominated by low-star repos, so
// the default keeps them (they are the real agent-PR population) and popular
// repos come from the dedicated probe in discover-popular.mjs.
export const STAR_MIN = Number(process.env.STUDY_STAR_MIN ?? 0);
export const PER_REPO_CAP = Number(process.env.STUDY_PER_REPO_CAP ?? 3);
export const TARGET_MAX = Number(process.env.STUDY_TARGET_MAX ?? 1_400);
export const STAR_BANDS = [
  { key: "200-1k", min: 200, max: 999 },
  { key: "1k-10k", min: 1_000, max: 9_999 },
  { key: "10k+", min: 10_000, max: Infinity },
];

// Scan pacing: keep worst-case core API usage under 5000/hour.
export const SCAN_SLEEP_MS = 3_500;
export const RATE_CHECK_EVERY = 25;
export const RATE_MIN_REMAINING = 600;
export const SCAN_TIMEOUT_MS = 120_000;

export const CLI_DIST = new URL("../../packages/cli/dist/main.js", import.meta.url).pathname;
