"""Builders shared by the experience seam tests and the AC-1 to AC-12 journey. Synthetic data only: every
person, organisation and address here is fictional and uses a reserved example domain."""

from __future__ import annotations

from types import SimpleNamespace

from apps.aicore.core.providers import SimulatedProvider
from apps.aidata import ai, workspace
from apps.aidata.models import DraftMode
from apps.enquiries import ingest
from apps.portal import services as portal
from apps.portal.models import Role
from tests.portal_helpers import make_member, make_staff
from tests.test_aidata_intake import notification_body, raw

MARKER = "[vitalos-brief v1 questions=checklist brief=checklist]"

#: The website's guided-brief composition (W6, docs/ai-data/engineering/guided-brief.md): the marker is the
#: first line of the problem section, the visitor's own lines carry "You said:", "Q:" and "A:".
GUIDED_GOAL = f"""Vitalos AI & Data enquiry
Sector: Accounting and bookkeeping
Business problem or workflow:
{MARKER}
You said: We match supplier statements to the purchase ledger by hand every month and it takes two days.
Follow-up answers (you said):
Q: Which tools are involved?
A: Xero and a shared spreadsheet
Possible automation (suggested from our checklist):
- Read the statements
- Propose matches against the ledger
Unknowns (suggested from our checklist):
- How many suppliers send scanned copies
Current tools and process:
Statements arrive as PDFs and one person re-keys each line into Xero.
Desired outcome:
Exceptions are flagged automatically so a person only checks those.
Indicative budget: £1,000–£5,000 (enquirer's estimate)"""


def guided_raw(message_id: str = "guided-1") -> bytes:
    """The website's notification email for a guided-brief enquiry, as the inbound mail handler receives it."""
    return raw(message_id=message_id, body=notification_body(GUIDED_GOAL))


def file_guided_enquiry(message_id: str = "guided-1"):
    """Deliver the notification through the existing ingest path; returns (message, created)."""
    return ingest.ingest(guided_raw(message_id), provider="cloudflare")


def scripted_provider(problem: str | None = None):
    """A hand-written SimulatedProvider answer for the brief prompt. The quotes are real spans of the
    notification, so they pass the unsupported-claim check. This is a scripted double, not a live model."""
    problem = (
        problem or "Supplier statements are matched to the purchase ledger by hand, taking two days a month."
    )
    simulated = SimulatedProvider(
        [
            {
                "respond": {
                    "fields": [
                        {
                            "name": "problem_summary",
                            "value": problem,
                            "quote": "We match supplier statements to the purchase ledger by hand every month",
                        },
                        {
                            "name": "desired_outcome",
                            "value": "Exceptions are flagged automatically so a person only checks those.",
                            "quote": "Exceptions are flagged automatically so a person only checks those.",
                        },
                    ],
                    "offer": {
                        "value": "ai-proof-of-value",
                        "reasons": ["They want to test whether it works."],
                    },
                    "next_action": {
                        "value": "Book a discovery call",
                        "reasons": ["Problem and outcome are stated."],
                    },
                    "unclear": [],
                }
            }
        ]
    )
    ai.set_provider_override(simulated)
    return simulated


def approved_brief(opportunity, actor, *, key="exp-brief", mode=DraftMode.AI, edit=None):
    """Prepare a brief from the original enquiry and approve it (the operator's decision)."""
    draft, _ = workspace.prepare_brief_from_enquiry(opportunity, key=key, actor=actor, mode=mode)
    values = {name: draft.payload["fields"].get(name, "") for name in workspace.BRIEF_FORM_FIELDS}
    values.update(edit or {})
    workspace.apply_brief(draft, values, actor, offer="ai-proof-of-value", accept=set(values))
    draft.refresh_from_db()
    return draft


def approved_proposal(opportunity, actor, *, key="exp"):
    """Approved discovery then an approved proposal draft, built by rules (no model)."""
    from tests.test_aidata_workspace import NOTES

    pack, _ = workspace.start_discovery(
        opportunity, notes=NOTES, key=f"{key}-d", actor=actor, mode=DraftMode.RULES
    )
    workspace.mark_reviewed(pack, actor)
    workspace.approve(pack, actor)
    proposal, _ = workspace.start_proposal(opportunity, key=f"{key}-p", actor=actor)
    workspace.mark_reviewed(proposal, actor)
    return workspace.approve(proposal, actor)


def two_orgs():
    """Staff, Northwind Synthetic Ltd (org A, with an approver and a viewer) and Contoso Synthetic plc (org B)."""
    staff = make_staff()
    w = SimpleNamespace(staff=staff)
    w.org_a = portal.create_organisation(name="Northwind Synthetic Ltd", actor=staff, synthetic=True)
    w.org_b = portal.create_organisation(name="Contoso Synthetic plc", actor=staff, synthetic=True)
    w.approver = make_member(w.org_a, "alma@northwind.example.test", Role.APPROVER, "Alma Approver")
    w.viewer = make_member(w.org_a, "vera@northwind.example.test", Role.VIEWER, "Vera Viewer")
    w.b_approver = make_member(w.org_b, "bea@contoso.example.test", Role.APPROVER, "Bea Contoso")
    return w
