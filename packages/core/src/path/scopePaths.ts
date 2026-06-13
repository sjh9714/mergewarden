import type { FileChange } from "../types.js";

export function scopePathsForFile(file: FileChange): string[] {
  return [file.previousPath, file.path].filter((path): path is string => Boolean(path?.trim()));
}
