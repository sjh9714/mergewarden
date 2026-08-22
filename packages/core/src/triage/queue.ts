const UNIFORM_THRESHOLD = 0.8;
const UNIFORM_MIN_PULLS = 8;

export function partitionUniformTriageNotes<T extends { notes: string[] }>(
  rows: T[],
): {
  uniform: string[];
  rows: T[];
} {
  if (rows.length < UNIFORM_MIN_PULLS) {
    return { uniform: [], rows };
  }

  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const note of row.notes) {
      counts.set(note, (counts.get(note) ?? 0) + 1);
    }
  }

  const uniform = [...counts.entries()]
    .filter(([, count]) => count / rows.length >= UNIFORM_THRESHOLD)
    .map(([note]) => note);

  if (uniform.length === 0) {
    return { uniform: [], rows };
  }

  return {
    uniform,
    rows: rows.map((row) => ({
      ...row,
      notes: row.notes.filter((note) => !uniform.includes(note)),
    })),
  };
}
