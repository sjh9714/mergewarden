import type { ZodIssue } from "zod";

function formatPath(path: ZodIssue["path"]): string {
  return path.length > 0 ? path.map(String).join(".") : "<root>";
}

export function formatZodIssues(issues: ZodIssue[]): string {
  return issues
    .map((issue) => {
      if (issue.code === "unrecognized_keys") {
        const prefix = issue.path.length > 0 ? `${formatPath(issue.path)}.` : "";
        return issue.keys.map((key) => `${prefix}${key}: unrecognized key`).join("; ");
      }

      return `${formatPath(issue.path)}: ${issue.message}`;
    })
    .join("; ");
}
