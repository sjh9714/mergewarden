import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { QueueResult } from "../src/QueueResult.js";
import type { PublicTriageResult } from "../src/triage.js";

function result(overrides: Partial<PublicTriageResult> = {}): PublicTriageResult {
  return {
    target: { owner: "owner", repo: "repo" },
    openPullRequests: 4,
    externalPullRequests: 2,
    trustedPullRequests: 1,
    automationPullRequests: 1,
    unreadablePullRequests: [],
    analysisComplete: true,
    uniformNotes: ["no linked issue"],
    rows: [
      {
        number: 12,
        title: "Render <img src=x onerror=alert(1)>",
        author: "patch-author",
        authorAssociation: "FIRST_TIME_CONTRIBUTOR",
        firstContribution: true,
        filesChanged: 61,
        linesChanged: 1_804,
        updatedAt: "2026-08-22T00:00:00Z",
        htmlUrl: "https://github.com/owner/repo/pull/12",
        notes: ["thin description", "oversized"],
      },
    ],
    ...overrides,
  };
}

describe("QueueResult", () => {
  it("renders escaped pull request data and ordinary review links", () => {
    const html = renderToStaticMarkup(<QueueResult result={result({ openPullRequests: 1 })} />);

    expect(html).toContain("Render &lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("1 external pull request read");
    expect(html).not.toContain("1 external pull requests read");
    expect(html).toContain("Latest 1 open PR · 2 external");
    expect(html).not.toContain("Latest 1 open PRs");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain('href="https://github.com/owner/repo/pull/12"');
    expect(html).toContain('href="#pr=owner%2Frepo%2312"');
    expect(html).toContain("First contribution");
    expect(html).toContain("thin description");
    expect(html).toContain("Repository pattern");
  });

  it("shows incomplete and empty states without claiming a clean queue", () => {
    const html = renderToStaticMarkup(
      <QueueResult
        result={result({
          rows: [],
          unreadablePullRequests: [12],
          analysisComplete: false,
          uniformNotes: [],
        })}
      />,
    );

    expect(html).toContain("Review queue incomplete");
    expect(html).toContain("PR #12 could not be read");
    expect(html).not.toContain("No external pull requests need a first read");
  });
});
