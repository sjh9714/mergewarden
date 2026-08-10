#!/usr/bin/env node
/**
 * When an agent PR edits the files that steer coding agents, does any human say anything
 * about those files before merge?
 *
 * The README's opening claims a change like this "shows up in nothing anyone reviews
 * afterwards". That sentence has never been measured. This script measures the closest
 * checkable angle: review activity at merge time, on the 86 PRs out of the 2,204-PR scan
 * whose report carries an `agent-control-plane/drift` finding.
 *
 * Three signals are counted separately and never summed (the disclosure study's rule:
 * merging signals is how a compliant case gets reported as non-compliant):
 *
 *   review        — a formal review (approve/comment/request-changes) by a human who is
 *                   not the PR author
 *   inline-on-file — an inline review comment whose `path` is one of the instruction
 *                   files the finding flagged
 *   mention       — an issue comment by a non-author human whose text names one of those
 *                   files (conversation-level, not attached to a file)
 *
 * A PR that could not be read is counted as unreadable, not as "no review" — a gap in
 * the analysis is not a fact about the pull request.
 *
 * Usage: GH_TOKEN required.  node tools/study/instruction-file-reviews.mjs
 * Appends to tools/study/data/instruction-file-reviews.jsonl (gitignored).
 */
import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { DATA_DIR } from "./config.mjs";
import { appendJsonl, ensureDataDir, ghApi, readJsonl, sleep } from "./lib.mjs";

const RESULTS = join(DATA_DIR, "results.jsonl");
const OUT = join(DATA_DIR, "instruction-file-reviews.jsonl");
const SLEEP_MS = 350;

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.error("GH_TOKEN is required: 258 API calls do not fit the unauthenticated quota.");
  process.exit(2);
}

function isBot(user) {
  const login = user?.login ?? "";
  return user?.type === "Bot" || login.endsWith("[bot]");
}

/** Read results.jsonl line by line; the file is 3.5 MB of JSON-per-line with large reports. */
async function loadCohort() {
  const cohort = [];
  const rl = createInterface({ input: createReadStream(RESULTS), crlfDelay: Infinity });

  for await (const line of rl) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    const findings = row.report?.findings ?? [];
    const paths = [
      ...new Set(
        findings
          .filter((f) => f.ruleId === "agent-control-plane/drift")
          .map((f) => f.path)
          .filter(Boolean),
      ),
    ];

    if (paths.length > 0) {
      cohort.push({ key: row.key, repo: row.repo, number: row.number, url: row.url, paths });
    }
  }

  return cohort;
}

/** key → PR author login, joined from the discovery files that still carry it. */
function loadAuthors() {
  const authors = new Map();
  for (const file of ["candidates.jsonl", "targets.jsonl"]) {
    const path = join(DATA_DIR, file);
    if (!existsSync(path)) continue;
    for (const row of readJsonl(path)) {
      if (row.key && row.author) authors.set(row.key, row.author);
    }
  }
  return authors;
}

/**
 * -X GET is load-bearing. `gh api` switches to POST when -F fields are present, and
 * POST /pulls/{n}/reviews accepts an empty body: the first run of this script created an
 * empty pending review draft on all 86 pull requests instead of reading anything. They
 * were invisible to others (pending reviews are private until submitted) and were all
 * deleted, but a measurement script must be structurally unable to write, so every call
 * goes through this wrapper rather than trusting each call site to remember a flag.
 */
function ghGet(path, params = []) {
  return ghApi(["-X", "GET", path, ...params]);
}

/**
 * Whether each flagged instruction file was added or modified. The distinction carries the
 * story: a PR that introduces AGENTS.md is visible for what it is (echarts#21587 is one,
 * and its approval says so), while a modification is the case the README describes.
 */
async function instructionFileStatuses(base, paths) {
  const statuses = {};
  for (let page = 1; page <= 30; page += 1) {
    const files = await ghGet(`${base}/files`, ["-F", "per_page=100", "-F", `page=${page}`]);
    for (const f of files) {
      if (paths.includes(f.filename)) statuses[f.filename] = f.status;
    }
    if (files.length < 100) break;
  }
  return statuses;
}

async function measure(pr, author) {
  const base = `repos/${pr.repo}/pulls/${pr.number}`;
  const reviews = await ghGet(`${base}/reviews`, ["-F", "per_page=100"]);
  const inline = await ghGet(`${base}/comments`, ["-F", "per_page=100"]);
  const issueComments = await ghGet(`repos/${pr.repo}/issues/${pr.number}/comments`, [
    "-F",
    "per_page=100",
  ]);
  const fileStatuses = await instructionFileStatuses(base, pr.paths);

  const notAuthorHuman = (u) => !isBot(u) && u?.login !== author;
  const humanReviews = reviews.filter((r) => notAuthorHuman(r.user));
  const inlineOnFile = inline.filter(
    (c) => notAuthorHuman(c.user) && pr.paths.includes(c.path ?? ""),
  );
  const inlineElsewhere = inline.filter(
    (c) => notAuthorHuman(c.user) && !pr.paths.includes(c.path ?? ""),
  );
  const mentions = issueComments.filter(
    (c) =>
      notAuthorHuman(c.user) &&
      pr.paths.some((p) => (c.body ?? "").toLowerCase().includes(p.toLowerCase())),
  );

  return {
    key: pr.key,
    repo: pr.repo,
    number: pr.number,
    url: pr.url,
    author: author ?? null,
    instructionPaths: pr.paths,
    instructionFileStatuses: fileStatuses,
    humanReviewCount: humanReviews.length,
    humanApprovalCount: humanReviews.filter((r) => r.state === "APPROVED").length,
    inlineOnInstructionFile: inlineOnFile.length,
    inlineElsewhere: inlineElsewhere.length,
    issueCommentMentions: mentions.length,
    humanIssueCommentCount: issueComments.filter((c) => notAuthorHuman(c.user)).length,
  };
}

ensureDataDir();
const cohort = (await loadCohort()).sort(
  (a, b) => a.repo.localeCompare(b.repo) || a.number - b.number,
);
const authors = loadAuthors();
console.log(`cohort: ${cohort.length} PRs with an agent-control-plane finding`);

const done = new Set(
  existsSync(OUT) ? readJsonl(OUT).map((r) => r.key ?? `${r.repo}#${r.number}`) : [],
);

let read = 0;
let unreadable = 0;

for (const pr of cohort) {
  if (done.has(pr.key)) {
    read += 1;
    continue;
  }

  try {
    const record = await measure(pr, authors.get(pr.key));
    appendJsonl(OUT, record);
    read += 1;
    process.stdout.write(
      `${pr.repo}#${pr.number}`.padEnd(52) +
        ` reviews ${record.humanReviewCount}  inline-on-file ${record.inlineOnInstructionFile}  mentions ${record.issueCommentMentions}\n`,
    );
  } catch (error) {
    unreadable += 1;
    appendJsonl(OUT, {
      key: pr.key,
      repo: pr.repo,
      number: pr.number,
      url: pr.url,
      error: String(error?.stderr ?? error?.message ?? error).slice(0, 200),
    });
    process.stdout.write(`${pr.repo}#${pr.number}`.padEnd(52) + " UNREADABLE\n");
  }

  await sleep(SLEEP_MS);
}

console.log(`\nread ${read} / unreadable ${unreadable} / total ${cohort.length}`);
console.log(`appended to ${OUT}`);
