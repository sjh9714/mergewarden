import type { MouseEvent } from "react";

import { targetHash } from "./product.js";
import type { PublicTriageResult } from "./triage.js";

function updatedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function QueueResult({
  result,
  onScanPullRequest,
}: {
  result: PublicTriageResult;
  onScanPullRequest?: (target: string) => void;
}) {
  function scanPullRequest(event: MouseEvent<HTMLAnchorElement>, target: string) {
    if (onScanPullRequest) {
      event.preventDefault();
      onScanPullRequest(target);
    }
  }

  return (
    <section className="result-shell queue-result" aria-live="polite" tabIndex={-1}>
      <div className="result-kicker">External PR review queue</div>
      <p className="result-context">
        {result.target.owner}/{result.target.repo}
      </p>
      <h2>
        {result.rows.length} external pull request{result.rows.length === 1 ? "" : "s"} read
      </h2>
      <p className="queue-summary">
        Latest {result.openPullRequests} open PRs · {result.externalPullRequests} external ·{" "}
        {result.trustedPullRequests} trusted · {result.automationPullRequests} automation
      </p>

      {!result.analysisComplete ? (
        <div className="incomplete" role="status">
          <h3>Review queue incomplete</h3>
          <p>
            {result.unreadablePullRequests.length === 1
              ? `PR #${result.unreadablePullRequests[0]} could not be read.`
              : `PRs ${result.unreadablePullRequests.map((number) => `#${number}`).join(", ")} could not be read.`}{" "}
            Do not treat this queue as complete.
          </p>
        </div>
      ) : null}

      {result.uniformNotes.length > 0 ? (
        <div className="queue-norm">
          <span>Repository pattern</span>
          <p>{result.uniformNotes.join(", ")} appears on nearly every external PR shown.</p>
        </div>
      ) : null}

      {result.rows.length === 0 && result.analysisComplete ? (
        <p className="queue-empty">No external pull requests need a first read.</p>
      ) : null}

      <div className="queue-rows">
        {result.rows.map((row) => {
          const target = `${result.target.owner}/${result.target.repo}#${row.number}`;
          return (
            <article className="queue-row" key={row.number}>
              <div className="queue-row-heading">
                <span className="queue-number">#{row.number}</span>
                <h3>
                  <a href={row.htmlUrl} target="_blank" rel="noreferrer noopener">
                    {row.title}
                  </a>
                </h3>
              </div>
              <p className="queue-meta">
                @{row.author}
                {row.firstContribution ? <span>First contribution</span> : null}
              </p>
              <p className="queue-metrics">
                {row.filesChanged} files · {row.linesChanged} lines · updated{" "}
                <time dateTime={row.updatedAt}>{updatedDate(row.updatedAt)}</time>
              </p>
              <div className="queue-notes" aria-label="Review context">
                {row.notes.length > 0 ? (
                  row.notes.map((note) => <span key={note}>{note}</span>)
                ) : (
                  <span className="queue-note-clear">No missing context found</span>
                )}
              </div>
              <a
                className="detail-link"
                href={targetHash(target)}
                onClick={(event) => scanPullRequest(event, target)}
              >
                Run detailed risk scan
              </a>
            </article>
          );
        })}
      </div>

      <a
        className="star-link queue-star"
        href="https://github.com/sjh9714/mergewarden"
        target="_blank"
        rel="noreferrer noopener"
      >
        Useful queue? Star MergeWarden on GitHub
      </a>
    </section>
  );
}
