// Phase 2: run the local MergeWarden CLI against each target PR.
// Resumable: appends to results.jsonl and skips already-scanned keys.
// Usage: node tools/study/scan.mjs [limit]

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  CLI_DIST,
  DATA_DIR,
  RATE_CHECK_EVERY,
  RATE_MIN_REMAINING,
  SCAN_SLEEP_MS,
  SCAN_TIMEOUT_MS,
} from "./config.mjs";
import { appendJsonl, ensureDataDir, execFileAsync, ghApi, readJsonl, sleep } from "./lib.mjs";

const TARGETS = join(DATA_DIR, "targets.jsonl");
const RESULTS = join(DATA_DIR, "results.jsonl");

const execFileRaw = promisify(execFile);

function classify(exitCode, stdout, stderr) {
  if ((exitCode === 0 || exitCode === 1) && stdout.trim()) {
    return "ok";
  }

  if (exitCode === 2 && stdout.trim()) {
    return "incomplete";
  }

  if (/not found|404/i.test(stderr)) {
    return "pr-not-found";
  }

  if (/head\.repo was not an object/i.test(stderr)) {
    return "head-repo-missing";
  }

  if (/rate limit|403|429/i.test(stderr)) {
    return "rate-limited";
  }

  if (/timed? ?out|ETIMEDOUT/i.test(stderr)) {
    return "timeout";
  }

  return "other";
}

async function waitForRateBudget() {
  const rate = await ghApi(["rate_limit", "--jq", ".resources.core"]);
  if (rate.remaining >= RATE_MIN_REMAINING) {
    return;
  }

  const waitMs = Math.max(0, rate.reset * 1000 - Date.now()) + 30_000;
  process.stderr.write(
    `core rate low (${rate.remaining}); sleeping ${Math.round(waitMs / 1000)}s\n`,
  );
  await sleep(waitMs);
}

async function scanOne(target, token) {
  const started = Date.now();
  let exitCode = 0;
  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileRaw(
      "node",
      [CLI_DIST, "scan", `${target.repo}#${target.number}`, "--format", "json"],
      {
        env: { ...process.env, GH_TOKEN: token },
        timeout: SCAN_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    exitCode = typeof error.code === "number" ? error.code : -1;
    stdout = error.stdout ?? "";
    stderr = error.stderr ?? `${error.message ?? ""}`;
    if (error.killed) {
      stderr += " timed out";
    }
  }

  const bucket = classify(exitCode, stdout, stderr);
  let report = null;
  if (bucket === "ok" || bucket === "incomplete") {
    try {
      report = JSON.parse(stdout);
    } catch {
      report = null;
    }
  }

  return {
    key: target.key,
    repo: target.repo,
    number: target.number,
    cohorts: target.cohorts,
    stars: target.stars,
    language: target.language,
    created: target.created,
    url: target.url,
    exitCode,
    bucket,
    ms: Date.now() - started,
    report,
    stderrTail: stderr.slice(-500),
  };
}

async function main() {
  ensureDataDir();
  const limit = Number(process.argv[2] ?? Infinity);
  const targets = readJsonl(TARGETS);
  const done = new Set(readJsonl(RESULTS).map((r) => r.key));
  const { stdout: tokenOut } = await execFileAsync("gh", ["auth", "token"]);
  const token = tokenOut.trim();

  let scanned = 0;
  const bucketCounts = new Map();

  for (const target of targets) {
    if (done.has(target.key)) {
      continue;
    }

    if (scanned >= limit) {
      break;
    }

    if (scanned > 0 && scanned % RATE_CHECK_EVERY === 0) {
      await waitForRateBudget();
    }

    let record = await scanOne(target, token);
    if (record.bucket === "rate-limited") {
      await waitForRateBudget();
      record = await scanOne(target, token);
    }

    appendJsonl(RESULTS, record);
    scanned += 1;
    bucketCounts.set(record.bucket, (bucketCounts.get(record.bucket) ?? 0) + 1);

    if (scanned % 10 === 0) {
      const summary = [...bucketCounts.entries()].map(([k, v]) => `${k}=${v}`).join(" ");
      process.stderr.write(`scanned ${scanned} (${done.size} previously): ${summary}\n`);
    }

    await sleep(SCAN_SLEEP_MS);
  }

  const summary = [...bucketCounts.entries()].map(([k, v]) => `${k}=${v}`).join(" ");
  process.stderr.write(`scan pass complete: ${scanned} new (${summary})\n`);
}

await main();
