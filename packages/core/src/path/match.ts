import picomatch from "picomatch";

import { normalizePath } from "./normalizePath.js";

const MATCH_OPTIONS = { dot: true };

export function findMatchingPatterns(path: string, patterns: string[]): string[] {
  const normalizedPath = normalizePath(path);

  return patterns.filter((pattern) =>
    picomatch.isMatch(normalizedPath, normalizePath(pattern), MATCH_OPTIONS),
  );
}

export function matchesAny(path: string, patterns: string[]): boolean {
  return findMatchingPatterns(path, patterns).length > 0;
}
