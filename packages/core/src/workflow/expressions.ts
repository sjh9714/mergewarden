/** Canonicalize equivalent GitHub expression property syntax without evaluating expressions. */
export function canonicalizeExpressionReferences(value: string): string {
  return value
    .replace(/\[\s*['"]([A-Za-z_][A-Za-z0-9_-]*)['"]\s*\]/g, ".$1")
    .replace(/\s*\.\s*/g, ".");
}

export function extractGitHubExpressionBodies(value: string): string[] {
  return [...value.matchAll(/\$\{\{([\s\S]*?)\}\}/g)].flatMap((match) =>
    match[1] ? [canonicalizeExpressionReferences(match[1])] : [],
  );
}
