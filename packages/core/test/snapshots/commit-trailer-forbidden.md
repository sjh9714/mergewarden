### ERROR commit/trailer-forbidden

Commit 0123456789ab carries a Co-authored-by trailer this repository does not accept.

Finding ID: agf_f46570d2a0c13b55
Disposition: active

Evidence Snapshot:

- ruleId: commit/trailer-forbidden
- severity: error
- evidence.commit: 0123456789ab
- evidence.matched_pattern: \*claude\*
- evidence.trailer: Co-authored-by
- evidence.value: Claude &lt;noreply@​anthropic.com&gt;

Evidence:

- commit: 0123456789ab
- trailer: Co-authored-by
- value: Claude &lt;noreply@​anthropic.com&gt;
- matched_pattern: \*claude\*

Remediation:

- Remove the "Co-authored-by" trailer from the commit message, then force-push the amended commit.
