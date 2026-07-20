# Security Policy

MergeWarden is a security-adjacent developer tool for deterministic policy
evidence on AI-generated pull requests.

## Reporting a Vulnerability

Do not open a public issue for vulnerabilities or sensitive findings. Use
GitHub private vulnerability reporting from this repository's Security tab. If
it is unavailable, contact the maintainer privately before sharing details.

Relevant reports include execution of PR-controlled code, head-branch policy
loading, unsafe token/API handling, incomplete analysis presented as a pass,
report injection, or unauthorized comment replacement.

## Non-Goals

MergeWarden is not a semantic vulnerability scanner and does not claim to find
all security bugs, prove correctness, or replace human review. See the full
[security model](docs/security-model.md).
