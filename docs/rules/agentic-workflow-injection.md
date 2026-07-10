# Agentic Workflow Injection

Rule ID: `workflow/agentic-untrusted-input`

Agent Gate reports when untrusted GitHub event text is newly connected to a
registered coding-agent prompt input. The rule is deterministic and deliberately
narrow; it is not a general workflow taint analyzer.

## Built-In Agent Actions

- `openai/codex-action`, prompt input `prompt`
- `anthropics/claude-code-action`, prompt input `prompt`
- `google-github-actions/run-gemini-cli`, prompt input `prompt`

Add a custom action through `agentic_workflows.additional_actions`.

## Sources

The v0.3 rule recognizes PR/issue/comment/review/discussion title or body,
branch names, and head commit messages. Dot and bracket GitHub-expression forms
are canonicalized only inside real `${{ ... }}` expressions.

Examples that produce the same source evidence:

```yaml
prompt: ${{ github.event.issue.body }}
prompt: ${{ github [ 'event' ] [ 'issue' ] [ 'body' ] }}
```

## One Environment Hop

The rule also resolves one workflow → job → step environment lookup:

```yaml
env:
  REVIEW_REQUEST: ${{ github.event.pull_request.body }}

steps:
  - uses: openai/codex-action@0123456789012345678901234567890123456789
    with:
      prompt: ${{ env.REVIEW_REQUEST }}
```

It does not follow shell variables, files, step outputs, artifacts, or job-to-job
data flow.

## Severity

- `severity` applies when effective workflow/job permissions are explicitly
  read-only and the agent step receives no `secrets.*` expression.
- `privileged_severity` applies when permissions include write, are implicit or
  unknown, include OIDC, or the same agent step receives a secret expression.

The finding records source expression, sink action/input, job, and effective
capability. It says the prompt boundary changed; it does not prove exploitation.

## Configuration

```yaml
agentic_workflows:
  enabled: true
  severity: warn
  privileged_severity: error
  additional_actions:
    - uses: owner/custom-agent-action
      prompt_inputs: [prompt, instructions]
```

## Reducing Noise Safely

Prefer replacing attacker-controlled prompt text with fixed reviewed
instructions or isolating the agent in a read-only workflow. If the exact
finding is intentionally accepted, use an expiring base-policy waiver rather
than disabling the family.

## Fixtures

- Unsafe composite: `fixtures/unsafe-pr-zoo/composite-agent-boundary`
- Safe fixed prompt: `fixtures/safe-pr-zoo/agentic-reviewed-prompt`
