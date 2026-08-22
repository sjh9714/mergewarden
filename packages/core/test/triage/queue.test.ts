import { describe, expect, it } from "vitest";

import { partitionUniformTriageNotes } from "../../src/index.js";

describe("partitionUniformTriageNotes", () => {
  const rows = (notes: string[][]) => notes.map((entry) => ({ notes: entry }));

  it("lifts a note that appears on nearly every pull request out of the rows", () => {
    const input = rows([
      ...Array.from({ length: 14 }, () => ["no linked issue"]),
      ["no linked issue", "AI disclosed"],
    ]);

    expect(partitionUniformTriageNotes(input)).toEqual({
      uniform: ["no linked issue"],
      rows: [...Array.from({ length: 14 }, () => ({ notes: [] })), { notes: ["AI disclosed"] }],
    });
  });

  it("leaves a discriminating note in place", () => {
    const input = rows([
      ["oversized"],
      ["AI disclosed"],
      [],
      [],
      ["no linked issue"],
      [],
      [],
      [],
      [],
      [],
    ]);

    expect(partitionUniformTriageNotes(input)).toEqual({ uniform: [], rows: input });
  });

  it("does not call three of four a norm", () => {
    const input = rows([["no linked issue"], ["no linked issue"], ["no linked issue"], []]);

    expect(partitionUniformTriageNotes(input)).toEqual({ uniform: [], rows: input });
  });

  it("preserves row fields while removing uniform notes", () => {
    const input = Array.from({ length: 8 }, (_, index) => ({
      number: index + 1,
      notes: ["no linked issue", ...(index === 7 ? ["oversized"] : [])],
    }));

    const result = partitionUniformTriageNotes(input);

    expect(result.uniform).toEqual(["no linked issue"]);
    expect(result.rows[7]).toEqual({ number: 8, notes: ["oversized"] });
  });
});
