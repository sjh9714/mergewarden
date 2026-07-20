import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

import { DATA_DIR } from "./config.mjs";

export const execFileAsync = promisify(execFile);

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

export function readJsonl(path) {
  if (!existsSync(path)) {
    return [];
  }

  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function appendJsonl(path, record) {
  appendFileSync(path, `${JSON.stringify(record)}\n`);
}

// gh api with bounded retries for transient failures. Returns parsed JSON.
export async function ghApi(args, { retries = 3, backoffMs = 15_000 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const { stdout } = await execFileAsync("gh", ["api", ...args], {
        maxBuffer: 32 * 1024 * 1024,
      });
      return JSON.parse(stdout);
    } catch (error) {
      const message = `${error.stderr ?? ""}${error.message ?? ""}`;
      const transient = /rate limit|abuse|502|503|504|timeout|ECONNRESET/i.test(message);
      if (attempt >= retries || !transient) {
        throw error;
      }

      process.stderr.write(`gh api transient failure (attempt ${attempt}); backing off\n`);
      await sleep(backoffMs * attempt);
    }
  }
}

export function repoFromRepositoryUrl(repositoryUrl) {
  return repositoryUrl.replace("https://api.github.com/repos/", "");
}

export function isoDaysBefore(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
