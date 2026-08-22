import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Finding } from "@mergewarden/core";

import {
  buildInstallUrl,
  classifyTarget,
  classifyScanError,
  cliCommand,
  errorCopy,
  incompleteCopy,
  installWorkflow,
  parseShareHash,
  passCopy,
  queueCopy,
  repositoryHash,
  resultFindings,
  reviewHeading,
  targetHash,
  triageCliCommand,
  type PublicTargetKind,
  type ScanErrorKind,
} from "./product.js";
import { QueueResult } from "./QueueResult.js";
import { scanPublicPullRequest, type PublicScanResult } from "./scan.js";
import { triagePublicRepository, type PublicTriageResult } from "./triage.js";

type ScanState =
  | { kind: "idle" }
  | { kind: "loading"; targetKind: PublicTargetKind }
  | { kind: "error"; error: ScanErrorKind; target: string; targetKind: PublicTargetKind }
  | { kind: "pr-success"; scan: PublicScanResult }
  | { kind: "repository-success"; result: PublicTriageResult };

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="finding">
      <div className="finding-heading">
        <span className={`severity severity-${finding.severity}`}>{finding.severity}</span>
        <h3>{finding.title}</h3>
      </div>
      {finding.path ? <code className="path">{finding.path}</code> : null}
      <p>{finding.message}</p>
      {finding.remediation[0] ? (
        <p className="remediation">
          <span>What to check</span>
          {finding.remediation[0]}
        </p>
      ) : null}
    </article>
  );
}

function ExampleQueue() {
  return (
    <section className="result-shell example" aria-labelledby="example-title">
      <div className="result-kicker">Example review queue</div>
      <h2 id="example-title">3 external pull requests read</h2>
      <p className="result-context">framework/runtime</p>
      <div className="queue-rows example-queue">
        <article className="queue-row">
          <div className="queue-row-heading">
            <span className="queue-number">#184</span>
            <h3>Split Linux packaging changes</h3>
          </div>
          <p className="queue-meta">
            @mira-builds <span>First contribution</span>
          </p>
          <div className="queue-notes">
            <span>no linked issue</span>
            <span>oversized</span>
          </div>
        </article>
        <article className="queue-row">
          <div className="queue-row-heading">
            <span className="queue-number">#191</span>
            <h3>Document renderer cache behavior</h3>
          </div>
          <p className="queue-meta">@oakbyte</p>
          <div className="queue-notes">
            <span>thin description</span>
            <span>template unused</span>
          </div>
        </article>
        <article className="queue-row">
          <div className="queue-row-heading">
            <span className="queue-number">#176</span>
            <h3>Correct Windows path normalization</h3>
          </div>
          <p className="queue-meta">@postcard-labs</p>
          <div className="queue-notes">
            <span className="queue-note-clear">No missing context found</span>
          </div>
        </article>
      </div>
      <p className="example-note">Facts order the queue. They do not score the contributor.</p>
    </section>
  );
}

function LoadingResult({ targetKind }: { targetKind: PublicTargetKind }) {
  return (
    <section className="result-shell" aria-live="polite" aria-busy="true">
      <span className="sr-only">
        {targetKind === "repository" ? "Loading the review queue" : "Scanning the pull request"}
      </span>
      <div className="skeleton skeleton-short" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton-card">
        <div className="skeleton skeleton-chip" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line skeleton-wide" />
        <div className="skeleton skeleton-line" />
      </div>
      <div className="skeleton-card skeleton-card-short">
        <div className="skeleton skeleton-line skeleton-wide" />
      </div>
    </section>
  );
}

function ErrorResult({
  kind,
  target,
  targetKind,
}: {
  kind: ScanErrorKind;
  target: string;
  targetKind: PublicTargetKind;
}) {
  const content = errorCopy[kind];
  const showCli = kind === "unavailable" || kind === "rate-limit";

  return (
    <section className="result-shell error-result" role="alert" tabIndex={-1}>
      <div className="result-kicker">Request failed</div>
      <h2>{content.title}</h2>
      <p>{content.body}</p>
      {showCli ? (
        <div className="cli-alternative">
          <p>Use an authenticated CLI request</p>
          <pre tabIndex={0}>
            <code>
              {targetKind === "repository" ? triageCliCommand(target) : cliCommand(target)}
            </code>
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function Install({ scan }: { scan: PublicScanResult }) {
  const [copyStatus, setCopyStatus] = useState("");
  const installUrl = buildInstallUrl(
    scan.input.repo.owner,
    scan.input.repo.repo,
    scan.input.repo.defaultBranch,
  );

  async function copyWorkflow() {
    try {
      await navigator.clipboard.writeText(installWorkflow);
      setCopyStatus("Workflow copied.");
    } catch {
      setCopyStatus("Copy failed. Select the workflow below.");
    }
  }

  return (
    <section className="install" aria-labelledby="install-title">
      <div>
        <div className="result-kicker">Keep checking this repository</div>
        <h2 id="install-title">Add the PR check</h2>
        <p>Commit this workflow to run MergeWarden on future pull requests.</p>
      </div>
      <div className="install-actions">
        <button className="button button-secondary" type="button" onClick={copyWorkflow}>
          Copy workflow
        </button>
        <a
          className="button button-primary"
          href={installUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open GitHub
        </a>
      </div>
      <p className="copy-status" aria-live="polite">
        {copyStatus}
      </p>
      <pre className="workflow" tabIndex={0}>
        <code>{installWorkflow}</code>
      </pre>
      <a
        className="star-link"
        href="https://github.com/sjh9714/mergewarden"
        target="_blank"
        rel="noreferrer noopener"
      >
        Useful result? Star MergeWarden on GitHub
      </a>
    </section>
  );
}

function SuccessfulResult({ scan }: { scan: PublicScanResult }) {
  const { primary, remaining } = resultFindings(scan.result.findings);
  const total = primary.length + remaining.length;
  const complete = scan.result.metadata.analysisComplete;

  return (
    <div className="success-stack">
      <section className="result-shell" aria-live="polite" tabIndex={-1}>
        <div className="result-kicker">Scan result</div>
        <p className="result-context">
          {scan.input.repo.owner}/{scan.input.repo.repo} PR {scan.target.number}
        </p>
        <h2>{complete && total === 0 ? passCopy.title : reviewHeading(total)}</h2>
        {!complete ? (
          <div className="incomplete" role="status">
            <h3>{incompleteCopy.title}</h3>
            <p>{incompleteCopy.body}</p>
          </div>
        ) : total === 0 ? (
          <p>{passCopy.body}</p>
        ) : null}
        {primary.map((finding) => (
          <FindingCard finding={finding} key={finding.findingId} />
        ))}
        {remaining.length > 0 ? (
          <details className="remaining-findings">
            <summary>Show {remaining.length} more</summary>
            {remaining.map((finding) => (
              <FindingCard finding={finding} key={finding.findingId} />
            ))}
          </details>
        ) : null}
      </section>
      <Install scan={scan} />
    </div>
  );
}

export function App() {
  const [initialTarget] = useState(() => parseShareHash(window.location.hash));
  const [value, setValue] = useState(initialTarget?.value ?? "");
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const autoScanned = useRef(false);
  const scanSequence = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  async function runScan(target: string, requestedKind?: PublicTargetKind) {
    const scanId = ++scanSequence.current;
    const trimmed = target.trim();
    let targetKind: PublicTargetKind;

    try {
      targetKind = requestedKind ?? classifyTarget(trimmed);
    } catch (error) {
      setState({
        kind: "error",
        error: classifyScanError(error),
        target: trimmed,
        targetKind: "repository",
      });
      return;
    }

    setState({ kind: "loading", targetKind });
    window.history.replaceState(
      null,
      "",
      targetKind === "repository" ? repositoryHash(trimmed) : targetHash(trimmed),
    );

    try {
      if (targetKind === "repository") {
        const result = await triagePublicRepository(trimmed);
        if (scanId === scanSequence.current) {
          setState({ kind: "repository-success", result });
        }
      } else {
        const scan = await scanPublicPullRequest(trimmed);
        if (scanId === scanSequence.current) {
          setState({ kind: "pr-success", scan });
        }
      }
    } catch (error) {
      if (scanId === scanSequence.current) {
        setState({
          kind: "error",
          error: classifyScanError(error),
          target: trimmed,
          targetKind,
        });
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runScan(value);
  }

  useEffect(() => {
    if (!autoScanned.current && initialTarget) {
      autoScanned.current = true;
      void runScan(initialTarget.value, initialTarget.kind);
    }
  }, [initialTarget]);

  useEffect(() => {
    if (
      state.kind === "error" ||
      state.kind === "pr-success" ||
      state.kind === "repository-success"
    ) {
      resultRef.current?.focus();
    }
  }, [state]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="./">
          <span aria-hidden="true">MW</span>
          MergeWarden
        </a>
        <a
          className="header-link"
          href="https://github.com/sjh9714/mergewarden"
          target="_blank"
          rel="noreferrer noopener"
        >
          View source
        </a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">Maintainer review queue</div>
            <h1 id="hero-title">{queueCopy.title}</h1>
            <p className="lede">{queueCopy.body}</p>
            <form className="scan-form" onSubmit={submit} noValidate>
              <label htmlFor="github-target">GitHub repository or pull request</label>
              <div className="input-row">
                <input
                  id="github-target"
                  name="github-target"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  aria-describedby="github-target-help"
                  aria-invalid={state.kind === "error" && state.error === "invalid"}
                  placeholder="https://github.com/owner/repository"
                />
                <button className="button button-primary scan-button" type="submit">
                  Review
                </button>
              </div>
              <p id="github-target-help" className="helper">
                Repository URL or owner/repository. Pull request targets still run the detailed risk
                scan.
              </p>
              {state.kind === "error" && state.error === "invalid" ? (
                <p className="inline-error">Enter a valid public repository or pull request.</p>
              ) : null}
            </form>
            <ul className="boundaries" aria-label="Review queue boundaries">
              <li>Deterministic rules</li>
              <li>Public metadata only</li>
              <li>No data stored</li>
            </ul>
          </div>

          <div ref={resultRef} tabIndex={-1} className="result-column">
            {state.kind === "idle" ? <ExampleQueue /> : null}
            {state.kind === "loading" ? <LoadingResult targetKind={state.targetKind} /> : null}
            {state.kind === "error" ? (
              <ErrorResult kind={state.error} target={state.target} targetKind={state.targetKind} />
            ) : null}
            {state.kind === "repository-success" ? (
              <QueueResult
                result={state.result}
                onScanPullRequest={(target) => {
                  setValue(target);
                  void runScan(target, "pull-request");
                }}
              />
            ) : null}
            {state.kind === "pr-success" ? <SuccessfulResult scan={state.scan} /> : null}
          </div>
        </section>

        <section className="checks" aria-labelledby="checks-title">
          <div>
            <div className="eyebrow">Before code review</div>
            <h2 id="checks-title">Facts that decide what to open first</h2>
          </div>
          <ol className="check-list">
            <li>
              <span>01</span>
              Missing issue links
            </li>
            <li>
              <span>02</span>
              Thin descriptions
            </li>
            <li>
              <span>03</span>
              Skipped pull request templates
            </li>
            <li>
              <span>04</span>
              Oversized changes
            </li>
          </ol>
        </section>
      </main>

      <footer>
        <p>MergeWarden is open source and reads GitHub directly from your browser.</p>
        <p>No scores, auto-close, or AI judgment.</p>
      </footer>
    </div>
  );
}
