# Security Policy

Agent Gate is a prerelease, security-adjacent developer tool for inspecting
AI-generated pull requests with deterministic evidence.

## Reporting a Vulnerability

Please do not open a public issue for security vulnerabilities or sensitive
security findings.

Use GitHub private vulnerability reporting from the repository's Security tab
if it is available. If it is not available, contact the maintainer privately
before sharing reproduction details in public.

## Scope

Security issues may include:

- Action runtime behavior that executes PR-controlled code.
- Policy loading from an untrusted PR head instead of the PR base branch.
- Unsafe handling of GitHub tokens, PR contents, comments, or reports.
- Report rendering behavior that could mislead maintainers.

## Non-Goals

Agent Gate is not a semantic vulnerability scanner. It does not claim to find
all security bugs, prove semantic correctness, or replace human review.
