### ERROR commit/trailer-missing

Commit 0123456789ab does not carry a Assisted-by trailer.

Finding ID: agf_e11bd6c345a7b439
Disposition: active

Evidence Snapshot:

- ruleId: commit/trailer-missing
- severity: error
- evidence.applies_to: all
- evidence.commit: 0123456789ab
- evidence.expected_trailer: Assisted-by
- evidence.present_trailers: none
- evidence.subject: Add retry budget

Evidence:

- commit: 0123456789ab
- expected_trailer: Assisted-by
- applies_to: all
- present_trailers: none
- subject: Add retry budget

Remediation:

- Add a "Assisted-by: &lt;tool&gt;" trailer to the commit message, then force-push the amended commit.
