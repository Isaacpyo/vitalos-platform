# Rollback

Declare incident owner, preserve evidence, restore the recorded previous deployment/domain target, verify TLS/canonical/MX/navigation/forms, pause risky writes if necessary, communicate internally and document follow-up. Never delete the previous deployment before the observation window closes.

## What a deployment rollback does not undo

- Content: site content ships in the deployment (ADR-028), so rolling back the deployment rolls the content back too.
- Database: enquiries and outbox rows already written stay. Migrations so far are additive; do not drop columns or functions during an incident. After a rollback, check the outbox (`docs/runbooks/enquiry-delivery-failure.md`) so no stored enquiry goes unseen.
- DNS: restore the recorded Cloudflare values. HSTS, if it was enabled, makes browsers insist on https for the host for the configured period (`max-age=31536000`), so a rollback target must serve valid TLS.
- Redirects: they ship with the deployment (`docs/seo/redirect-inventory.md`); rolling back the deployment rolls them back.

## Pausing risky writes

To stop accepting enquiries without a deployment, set `VITALOS_ENQUIRY_BACKEND=disabled` (the contact page then shows the email alternative and the endpoint answers 503) and redeploy; stored data is untouched. Rotating secrets needs owner authorisation (`AGENTS.md`).
