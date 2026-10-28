# AI & Data workspace reliability cases (workspace-v1)

> **RELIABILITY ONLY. Model responses are hand-written test doubles. This shows the controls around the model work; it is not evidence of live model quality, and no live recordings exist.**

Cases: 22. Passed: 22. Gate: PASS. Fingerprint `468d982106c844b2`.

| Case | Category | Prompt | Gateway outcome | Result |
| --- | --- | --- | --- | --- |
| discovery-contradictory-notes-surface-the-conflict | contradictory | discovery_pack | success | pass |
| discovery-incomplete-notes-invent-nothing | incomplete | discovery_pack | success | pass |
| discovery-injection-in-notes | injection | discovery_pack | success | pass |
| discovery-invalid-json | invalid_json | discovery_pack | invalid_output | pass |
| discovery-provider-timeout-rules-still-reads-notes | provider_failure | discovery_pack | timeout | pass |
| discovery-unsupported-steps-and-requirements-dropped | unsupported | discovery_pack | success | pass |
| extract-contradictory-text | contradictory | brief_extract | success | pass |
| extract-incomplete-model-returns-nothing | incomplete | brief_extract | success | pass |
| extract-incomplete-no-contact | incomplete | brief_extract | success | pass |
| extract-injection-delimiter-and-instructions | injection | brief_extract | success | pass |
| extract-injection-model-obeys-adds-forbidden-keys | injection | brief_extract | invalid_output | pass |
| extract-invalid-json | invalid_json | brief_extract | invalid_output | pass |
| extract-provider-rejected | provider_failure | brief_extract | rejected | pass |
| extract-provider-timeout | provider_failure | brief_extract | timeout | pass |
| extract-provider-unavailable | provider_failure | brief_extract | unavailable | pass |
| extract-schema-invalid-enum | invalid_json | brief_extract | invalid_output | pass |
| extract-unsupported-name-not-in-quote | unsupported | brief_extract | success | pass |
| extract-unsupported-organisation-and-claim | unsupported | brief_extract | success | pass |
| proposal-adversarial-discovery-text-is-data | injection | proposal | built | pass |
| proposal-unknowns-become-dependencies-not-promises | incomplete | proposal | built | pass |
| questions-provider-unavailable-templates-used | provider_failure | discovery_questions | unavailable | pass |
| questions-schema-invalid-too-few | invalid_json | discovery_questions | invalid_output | pass |

## Gate

- pass: every case passes
- pass: every category has at least one case
- pass: the three workspace prompts and the proposal are all covered
