import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../../src/index.js";
import { createAnalysisInput, fileChange } from "../helpers.js";

const BASE = ["version: 1", "mode: warn", ""].join("\n");
const ALL_ON = ["version: 1", "mode: warn", "triage:", "  no_linked_issue: info", ""].join("\n");

function ruleIds(findings: { ruleId: string }[]) {
  return findings.map((finding) => finding.ruleId);
}

describe("triage/no-linked-issue", () => {
  it("is off by default, because most pull requests reference no issue", async () => {
    const result = await analyze(
      createAnalysisInput({ config: parseConfig(BASE), pr: { body: "A change with prose." } }),
    );

    expect(ruleIds(result.findings)).not.toContain("triage/no-linked-issue");
  });

  it("fires when enabled and nothing in the body points at an issue", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(ALL_ON),
        pr: { body: "Tidies the parser and renames a few locals for readability." },
      }),
    );

    expect(result.decision).toBe("pass");
    expect(ruleIds(result.findings)).toContain("triage/no-linked-issue");
  });

  it("accepts a bare reference, a closing keyword, or an issue URL", async () => {
    for (const body of [
      "Follow-up to #412, same parser path.",
      "Fixes #77 — the loop skipped the final frame.",
      "Closes https://github.com/owner/repo/issues/9 after the regression report.",
    ]) {
      const result = await analyze(
        createAnalysisInput({ config: parseConfig(ALL_ON), pr: { body } }),
      );
      expect(ruleIds(result.findings), body).not.toContain("triage/no-linked-issue");
    }
  });

  it("does not read a code span as an issue reference", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(ALL_ON),
        pr: { body: "Renames the `#123` anchor helper used by the docs build." },
      }),
    );

    expect(ruleIds(result.findings)).toContain("triage/no-linked-issue");
  });
});

describe("triage/empty-description", () => {
  it("fires on an empty body without changing the decision", async () => {
    const result = await analyze(
      createAnalysisInput({ config: parseConfig(BASE), pr: { body: "" } }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "triage/empty-description",
        severity: "info",
        evidence: expect.arrayContaining([{ label: "prose_characters", value: "0" }]),
      }),
    );
  });

  it("does not count template scaffolding as a description", async () => {
    const body = [
      "<!-- Describe your change below -->",
      "## Summary",
      "",
      "- [ ] Tests added",
      "- [ ] Docs updated",
    ].join("\n");
    const result = await analyze(createAnalysisInput({ config: parseConfig(BASE), pr: { body } }));

    expect(ruleIds(result.findings)).toContain("triage/empty-description");
  });
});

describe("triage/oversized-change", () => {
  it("fires past the configured file count", async () => {
    const files = Array.from({ length: 60 }, (_, index) => fileChange(`src/module-${index}.ts`));
    const result = await analyze(createAnalysisInput({ config: parseConfig(BASE), files }));

    expect(result.decision).toBe("pass");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "triage/oversized-change",
        severity: "info",
        evidence: expect.arrayContaining([{ label: "files_changed", value: "60" }]),
      }),
    );
  });

  it("stays silent inside the threshold", async () => {
    const files = Array.from({ length: 3 }, (_, index) => fileChange(`src/module-${index}.ts`));
    const result = await analyze(createAnalysisInput({ config: parseConfig(BASE), files }));

    expect(ruleIds(result.findings)).not.toContain("triage/oversized-change");
  });
});

describe("triage/template-unused", () => {
  const TEMPLATE = ["## Summary", "", "## Testing", "", "## Checklist"].join("\n");

  it("fires only when the body keeps none of the template sections", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(BASE),
        pr: { body: "Rewrote everything the template asked for in my own words instead." },
        repoDocs: { pullRequestTemplate: TEMPLATE },
      }),
    );

    expect(ruleIds(result.findings)).toContain("triage/template-unused");
  });

  it("treats a partly filled template as used", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(BASE),
        pr: { body: "## Summary\n\nFixes the retry budget so it resets between attempts." },
        repoDocs: { pullRequestTemplate: TEMPLATE },
      }),
    );

    expect(ruleIds(result.findings)).not.toContain("triage/template-unused");
  });

  it("stays inert when the repository has no template, and when none was looked for", async () => {
    const none = await analyze(
      createAnalysisInput({
        config: parseConfig(BASE),
        pr: { body: "A body." },
        repoDocs: { pullRequestTemplate: null },
      }),
    );
    const unknown = await analyze(
      createAnalysisInput({ config: parseConfig(BASE), pr: { body: "A body." } }),
    );

    expect(ruleIds(none.findings)).not.toContain("triage/template-unused");
    expect(ruleIds(unknown.findings)).not.toContain("triage/template-unused");
  });
});

describe("triage/unverified-author", () => {
  it("records a first-time contributor as context, at info", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(BASE),
        pr: { authorAssociation: "FIRST_TIME_CONTRIBUTOR" },
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "triage/unverified-author", severity: "info" }),
    );
  });

  it("stays silent for an established contributor, and when the field is absent", async () => {
    for (const authorAssociation of ["MEMBER", "OWNER", "CONTRIBUTOR", "COLLABORATOR"]) {
      const result = await analyze(
        createAnalysisInput({ config: parseConfig(BASE), pr: { authorAssociation } }),
      );
      expect(ruleIds(result.findings), authorAssociation).not.toContain("triage/unverified-author");
    }

    const absent = await analyze(createAnalysisInput({ config: parseConfig(BASE) }));
    expect(ruleIds(absent.findings)).not.toContain("triage/unverified-author");
  });
});

describe("triage configuration", () => {
  it("can switch every rule off", async () => {
    const config = [
      "version: 1",
      "mode: warn",
      "triage:",
      "  empty_description: off",
      "  template_unused: off",
      "  oversized_change: off",
      "  unverified_author: off",
      "",
    ].join("\n");
    const files = Array.from({ length: 60 }, (_, index) => fileChange(`src/module-${index}.ts`));
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(config),
        files,
        pr: { body: "", authorAssociation: "FIRST_TIME_CONTRIBUTOR" },
        repoDocs: { pullRequestTemplate: "## Summary" },
      }),
    );

    expect(ruleIds(result.findings).filter((id) => id.startsWith("triage/"))).toEqual([]);
  });

  it("can be raised to a severity that moves the decision", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          ["version: 1", "mode: warn", "triage:", "  empty_description: warn", ""].join("\n"),
        ),
        pr: { body: "" },
      }),
    );

    expect(result.decision).toBe("warn");
  });
});
