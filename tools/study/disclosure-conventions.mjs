#!/usr/bin/env node
/**
 * How does a project's AI-disclosure convention actually show up in its pull requests?
 *
 * Three signals are counted **separately and never summed**. Summing them is the mistake this
 * script exists to prevent: starship requires every contributor to disclose AI assistance and
 * carries zero commit trailers, because its convention is a section in the pull-request
 * template. A single "disclosure rate" would report a compliant project as non-compliant.
 *
 *   trailer   — a `Co-authored-by:` line written by a coding tool (commit metadata)
 *   template  — the repository's pull-request template offers a disclosure section, and the
 *               pull request body keeps it
 *   prose     — the body names a tool in running text, outside any template section
 *
 * Usage:
 *   node tools/study/disclosure-conventions.mjs <owner/repo> [<owner/repo> ...] [--limit N]
 *
 * Results append to tools/study/data/disclosure-conventions.jsonl, which is gitignored.
 */
import { join } from "node:path";

import { DATA_DIR } from "./config.mjs";
import { appendJsonl, ensureDataDir, execFileAsync, ghApi, sleep } from "./lib.mjs";

const OUT = join(DATA_DIR, "disclosure-conventions.jsonl");

/**
 * Addresses coding tools write into `Co-authored-by:`.
 *
 * Kept identical to `packages/core/src/rules/aiCoauthors.ts`, which documents where each came
 * from. Matching is on the address: `mdangelo@openai.com` and `etraut@openai.com` are in this
 * corpus and belong to people who work at OpenAI, so a domain test reports humans as AI. The
 * display name is worse — the same tool writes `Claude`, `Claude Opus 4.8` and
 * `Claude Opus 4.8 (1M context)`, and a person can type any of them.
 */
const TOOL_ADDRESSES = [
  { tool: "Claude Code", exact: "noreply@anthropic.com" },
  { tool: "Cursor", exact: "cursoragent@cursor.com" },
  { tool: "GitHub Copilot", exact: "copilot@github.com" },
  { tool: "Codex", exact: "codex@openai.com" },
  { tool: "GitHub Copilot", botLogin: "copilot" },
  { tool: "Devin", botLogin: "devin-ai-integration[bot]" },
  { tool: "Google Jules", botLogin: "google-labs-jules[bot]" },
];

function toolForAddress(email) {
  const address = email.trim().toLowerCase();

  for (const identity of TOOL_ADDRESSES) {
    if (identity.exact && address === identity.exact) {
      return identity.tool;
    }

    if (identity.botLogin) {
      const suffix = `+${identity.botLogin}@users.noreply.github.com`;
      const prefix = address.endsWith(suffix)
        ? address.slice(0, address.length - suffix.length)
        : undefined;

      if (prefix !== undefined && prefix.length > 0 && /^\d+$/.test(prefix)) {
        return identity.tool;
      }
    }
  }

  return undefined;
}

const COAUTHOR = /^co-authored-by:\s*(.*?)\s*<([^>]+)>\s*$/i;

function trailerTools(message) {
  const tools = new Set();

  for (const line of (message ?? "").split("\n")) {
    const match = COAUTHOR.exec(line.trim());
    const tool = match ? toolForAddress(match[2] ?? "") : undefined;

    if (tool) {
      tools.add(tool);
    }
  }

  return [...tools];
}

/**
 * Headings a template offers for disclosing AI assistance.
 *
 * The first version required the words "ai" or "llm" in the heading and missed Caddy's
 * `## Assistance Disclosure`, counting twelve template disclosures as prose. Projects name this
 * section for the act rather than the technology, so the act is what this matches.
 */
const DISCLOSURE_TERMS = /\b(ai|llm|artificial intelligence|assistance|disclosure|attribution)\b/i;
const HEADING_LINE = /^#{1,6}\s*(.+?)\s*$/;
// Not every template puts the field under a heading. OWASP Threat Dragon asks for it as a
// checklist item — "*or* any use of AI in this pull request has been disclosed below:" with
// tool and model sub-items — which a heading-only detector scores as no field at all. That is
// a false negative against one of the better-designed disclosure fields in this corpus.
const CHECKLIST_LINE = /^\s*[-*]\s*\[[ xX]\]\s*(.+?)\s*$/;

function disclosureAnchor(template) {
  for (const raw of template.split("\n")) {
    const line = raw.replace(/\*\*|[`*_]/g, "");
    const heading = HEADING_LINE.exec(line);

    if (heading && DISCLOSURE_TERMS.test(heading[1] ?? "")) {
      return { kind: "heading", text: (heading[1] ?? "").trim() };
    }

    const item = CHECKLIST_LINE.exec(line);

    if (item && DISCLOSURE_TERMS.test(item[1] ?? "")) {
      return { kind: "checklist", text: (item[1] ?? "").trim() };
    }
  }

  return undefined;
}

// Maintenance automation: a release bot does not disclose anything about itself.
const EXCLUDED_AUTHORS = new Set(["dependabot[bot]", "renovate[bot]", "github-actions[bot]"]);

const TEMPLATE_PATHS = [
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/pull_request_template.md",
  "PULL_REQUEST_TEMPLATE.md",
];

async function pullRequestTemplate(repo) {
  for (const path of TEMPLATE_PATHS) {
    try {
      const { stdout } = await execFileAsync(
        "gh",
        ["api", `repos/${repo}/contents/${path}`, "-H", "Accept: application/vnd.github.raw"],
        { maxBuffer: 8 * 1024 * 1024 },
      );
      return { path, text: stdout };
    } catch {
      continue;
    }
  }

  return undefined;
}

/**
 * Prose disclosure: the body names a tool in running text.
 *
 * Deliberately narrow. A body that merely contains the word "AI" is not a disclosure, and this
 * repository learned that the expensive way — starship has open pull requests about exposing a
 * Claude Code session id, which mention the tool without disclosing anything about authorship.
 */
const PROSE_DISCLOSURE =
  /\b(used|using|with|assisted|generated|written|authored|helped)\b[^.\n]{0,40}\b(claude|copilot|cursor|chatgpt|gpt-[45]|gemini|codex|llm|ai)\b/i;

function proseDiscloses(body) {
  const withoutComments = (body ?? "").replace(/<!--[\s\S]*?-->/g, " ");
  return PROSE_DISCLOSURE.test(withoutComments);
}

function parseArgs(argv) {
  const repos = [];
  let limit = 30;

  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--limit") {
      limit = Number(argv[++index]);
      continue;
    }

    repos.push(argv[index]);
  }

  if (repos.length === 0 || !Number.isInteger(limit) || limit < 1) {
    throw new Error(
      "Usage: node tools/study/disclosure-conventions.mjs <owner/repo> [...] [--limit N]",
    );
  }

  return { repos, limit };
}

async function measure(repo, limit) {
  const template = await pullRequestTemplate(repo);
  const anchor = template ? disclosureAnchor(template.text) : undefined;

  const pulls = await ghApi([
    "-X",
    "GET",
    `repos/${repo}/pulls`,
    "-f",
    "state=open",
    "-f",
    "sort=updated",
    "-f",
    "direction=desc",
    "-f",
    `per_page=${Math.min(limit, 100)}`,
  ]);

  const record = {
    repo,
    measuredPulls: 0,
    trailer: 0,
    template: 0,
    prose: 0,
    templatePath: template?.path,
    templateDisclosureAnchor: anchor?.text,
    templateDisclosureKind: anchor?.kind,
    tools: {},
  };

  for (const pull of pulls.slice(0, limit)) {
    if (EXCLUDED_AUTHORS.has(pull.user?.login ?? "")) {
      continue;
    }

    record.measuredPulls += 1;
    const body = pull.body ?? "";

    // Compare on a normalised line so that bold markers and back-ticks in the template do not
    // stop a body that kept the field from matching.
    const anchorText = anchor?.text.toLowerCase();

    if (
      anchorText &&
      body
        .replace(/\*\*|[`*_]/g, "")
        .toLowerCase()
        .includes(anchorText)
    ) {
      record.template += 1;
    }

    if (proseDiscloses(body)) {
      record.prose += 1;
    }

    const commits = await ghApi([
      "-X",
      "GET",
      `repos/${repo}/pulls/${pull.number}/commits`,
      "-f",
      "per_page=100",
    ]);
    const tools = new Set(commits.flatMap((commit) => trailerTools(commit.commit?.message)));

    if (tools.size > 0) {
      record.trailer += 1;
      for (const tool of tools) {
        record.tools[tool] = (record.tools[tool] ?? 0) + 1;
      }
    }

    await sleep(250);
  }

  return record;
}

const { repos, limit } = parseArgs(process.argv.slice(2));
ensureDataDir();

for (const repo of repos) {
  const record = await measure(repo, limit);
  appendJsonl(OUT, record);
  process.stdout.write(
    `${repo.padEnd(24)} pulls ${String(record.measuredPulls).padStart(3)} | trailer ${String(record.trailer).padStart(3)} | template ${String(record.template).padStart(3)} | prose ${String(record.prose).padStart(3)}${record.templateDisclosureAnchor ? `  (${record.templateDisclosureKind}: ${record.templateDisclosureAnchor.slice(0, 46)})` : ""}\n`,
  );
}

process.stdout.write(`\nAppended to ${OUT}\n`);
