# Demonstration: AI & Data connected experience (AC-1 to AC-12)

Everything here uses synthetic data on a local database. Nothing is sent, no live model is called, no Stripe call is made. The automated version of the same journey is `superadmin/tests/test_experience_journey.py`.

## Run it locally

From the repository root, with a local PostgreSQL (any empty database):

```sh
cd superadmin
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

export DATABASE_URL=postgres://postgres@127.0.0.1:5432/superadmin_demo   # an empty database you created
export DJANGO_SETTINGS_MODULE=config.settings.dev
export OTP_REQUIRED_FOR_SUPERADMIN=false      # local only: skip the authenticator step for the demo staff user
export AI_DATA_SIMULATED_PROVIDER=true        # local only: a labelled test double stands in for the model

sh bin/tailwind.sh                            # builds static/css/app.css (pinned Tailwind CLI)
python manage.py migrate
python manage.py seed_architecture
python manage.py experience_seed_demo         # add --without-project to click "Create portal project" yourself
python manage.py runserver 127.0.0.1:8000     # PORTAL_HOST is empty, so the portal is mounted at /portal/
```

`experience_seed_demo` refuses to run without DEBUG or in production, and prints generated logins once (staff, and two customer members of "Example Ledger Ltd (synthetic)"). A second organisation, "Contoso Synthetic plc" (`approver@contoso.example.test`), exists to check isolation. `--reset` rebuilds the portal side.

| What                | URL                                                       |
| ------------------- | --------------------------------------------------------- |
| Admin sign in       | http://127.0.0.1:8000/login/                              |
| Admin work queue    | http://127.0.0.1:8000/ai-data/                            |
| Opportunity         | http://127.0.0.1:8000/ai-data/pipeline/OPP-0001/          |
| Client portal admin | http://127.0.0.1:8000/client-portal/                      |
| Portal sign in      | http://127.0.0.1:8000/portal/sign-in/                     |
| Portal home         | http://127.0.0.1:8000/portal/                             |

Use two browser profiles (or one private window) so the staff and customer sessions do not mix.

## Walkthrough

"Admin" is `/ai-data/` and `/client-portal/`; "Portal" is `/portal/`.

| AC | Where | Steps |
| -- | ----- | ----- |
| AC-1 | Website (not part of the local seed) | A visitor completes the guided brief on `/ai-data/contact`. Its notification arrives as a message with `X-Vitalos-Pipeline: ai-data` and a first line `[vitalos-brief v1 questions=… brief=…]`. Locally, the journey test sends the same format through the real inbound path; or use **Paste an enquiry** in Admin. |
| AC-2 | Admin | The same notification delivered twice (or re-sent with the same VIT reference) gives one opportunity. Shown in the journey test; in the UI, open the enquiry and press **Create opportunity** twice: the second press opens the same record. |
| AC-3 | Admin | On the opportunity, **Prepare brief from the original enquiry**. With the kill switch off (Settings, AI) the brief is "Read by rules, no AI used" with the reason. With it on and `AI_DATA_SIMULATED_PROVIDER=true` it is "Suggested by AI (simulated test double)". |
| AC-4 | Admin | Edit any value in the preview and **Approve**. The opportunity is updated, the original text stays, the AI's proposal is kept beside the approved values. |
| AC-5 | Admin, then Portal | Opportunity, Workspace tab, **Link to client portal** (the approved brief travels as a draft; unapproved drafts, notes, scores and prices never do). Open the challenge, **Share with the customer**, **Propose to customer**. Sign in to the portal as Sam: the challenge shows "Your words", "Agreed fact" and "AI suggestion" tags and nothing internal. Press **Accept this brief**. |
| AC-6 | Admin, then Portal | Opportunity, Proposal tab (approved proposal), **Create portal project from proposal** (pressing it again opens the same project). Publish the project and its milestones. In the Portal the project shows milestones, and the dashboard shows the next milestone. |
| AC-7 | Admin, then Portal, then Admin | Challenge, **Ask a question**. In the Portal, Questions, open it and **Send answer**. Back in Admin the work queue shows "Read the customer's answer"; opening the challenge shows it and clears the item. |
| AC-8 | Admin | Deliverable, **New version**, then **Share with customer** (v1). Later create and share v2. |
| AC-9 | Portal | On v1 press **Request changes**. On v2 press **Approve version 2**. Approving v2 does not approve v1 and the reverse; an older version cannot be approved once a newer one is shared. |
| AC-10 | Admin and Portal | Admin work queue: "Changes requested on … v1", then "… v2 approved". The Admin deliverable page lists who, when and which version; so does the Portal deliverable page. |
| AC-11 | Portal | Sign in as `approver@contoso.example.test` and open the Example Ledger challenge, deliverable, a file download, search, notifications or the CSV export: every one is a 404. |
| AC-12 | Admin | Failed AI task: the work queue (Blocked) and the opportunity show it with **Retry** and **Prepare without AI**; the original enquiry is untouched. Failed email: see below. |

Also shown on the opportunity: **Opportunity is at Assessment / Proposal; customer sees Submitted.** with **Update customer-visible stage**. The customer-visible stage never changes by itself; the button is audited and writes a line to the customer's activity feed.

### Show a failed portal email, then the retry

In a Django shell (this makes the real send path fail once, then recover):

```python
from unittest import mock
from apps.accounts.models import User
from apps.portal import services
from apps.portal.models import Challenge
ch = Challenge.objects.get(organisation__name__startswith="Example")
staff = User.objects.get(email="synthetic.admin@example.test")
with mock.patch("apps.mailer.system.send", side_effect=RuntimeError("provider down")):
    services.ask_question(ch, question="Who signs off the exceptions list?", actor=staff)
```

Admin work queue (Blocked) and **Client portal, Email delivery, failed** show it. **Retry now** sends it once; a second press cannot send it again. Automatic retries stop after three attempts.

## Configuration-blocked in production

| Step | Blocked on |
| ---- | ---------- |
| Live AI briefs, discovery and portal assistant answers | The live model path is off and has no key. Everything above uses rules or a labelled simulated provider. An offline evaluation is not proof that a live provider works (AC-14 is not run). |
| Paying an invoice by card | Stripe: the keys and webhook are not configured in production; the demonstration makes no Stripe call. |
| `portal.vitalos.co.uk` | The DNS records and the managed certificate are created by the guarded Super Admin deploy; until then locally the portal is only at `/portal/`. |
| Portal file storage | `PORTAL_FILES_BUCKET` (a private bucket); without it production keeps no file bytes and says so. |
| Website guided brief | The website side (W5/W6) is separate from this seed; its brief-assist endpoint stays off until the "Website brief assist" switch is turned on. |

## Screenshots

Taken from a running local server with this seed (desktop 1440 px and mobile 390 px): admin work queue with portal items, opportunity with the portal panel and stage difference, creating the project from the proposal, the portal dashboard, the brief with provenance, the question and answer on both sides, the deliverable v2 decision on both sides, the other organisation's 404, and the failed email visible and retried.
