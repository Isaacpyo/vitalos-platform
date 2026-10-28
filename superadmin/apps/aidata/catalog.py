"""Offer definitions and offer-based templates (pure data), taken from docs/ai-data/commercial/.

03-offers.md defines purpose, inputs, deliverables, exit criteria and exclusions for the four offers;
05-discovery-questionnaire.md the questions. They are copied here so proposals and discovery questions
work with no model. Prices are NOT here: they live in ``OfferPrice`` (AI & Data > Offers) and are the
only prices a proposal may state, apart from an explicitly labelled estimate typed by a person.
"""

from __future__ import annotations

from .models import Offer

OFFER_DEFINITIONS: dict[str, dict] = {
    Offer.ASSESSMENT: {
        "name": "AI Opportunity Assessment",
        "purpose": "Decide whether and how one specific operational workflow can be improved, with AI, ordinary software, or not at all.",
        "customer_inputs": [
            "A description of the current process.",
            "Access to the people who do it (one observed run where possible).",
            "The systems used, with volumes and time estimates.",
            "Constraints, and non-sensitive or approved sample information.",
        ],
        "deliverables": [
            "Problem definition.",
            "Baseline workflow map.",
            "Baseline measures.",
            "Value hypothesis, with cash, capacity and revenue kept separate.",
            "Feasibility assessment, including non-AI alternatives.",
            "Security and data concerns.",
            "A recommended next step with an indicative cost.",
        ],
        "exit_criteria": "The customer can decide to fund a proof of value, buy an off-the-shelf tool, change the process, or stop, and the reasoning is written down.",
        "exclusions": [
            "Building anything.",
            "Processing production data at scale.",
            "Integrations.",
            "Legal or regulatory advice.",
            "Assessing more than one workflow (each extra workflow is a separate assessment).",
        ],
        "milestones": [
            (
                "Kick-off and access",
                "Confirm the workflow in scope, the people to talk to and the sample information.",
            ),
            ("Workflow observed and mapped", "Baseline workflow map and baseline measures agreed."),
            ("Assessment delivered", "Written assessment and recommendation presented."),
        ],
        "payment": "100% before work starts, where appropriate.",
    },
    Offer.PROOF_OF_VALUE: {
        "name": "AI Proof of Value",
        "purpose": "Test the critical part of the workflow on authorised data, with measured results, without pretending the prototype is production ready.",
        "customer_inputs": [
            "A signed scope.",
            "Authorised, representative test data via an approved route.",
            "A person to label expected results.",
            "Agreed success criteria.",
        ],
        "deliverables": [
            "A working bounded demonstration in a Vitalos-controlled environment.",
            "An evaluation report against the agreed metrics.",
            "Technical risks.",
            "Projected operating cost per task and per month.",
            "An implementation recommendation with an indicative production cost.",
        ],
        "exit_criteria": "The agreed metrics are measured on a held-out set and the customer sponsor records a go, no-go or change decision.",
        "exclusions": [
            "Production deployment.",
            "Live integrations that write to customer systems.",
            "User accounts for customer staff, unless stated.",
            "Support.",
            "Guarantees of production accuracy.",
        ],
        "milestones": [
            ("Scope and data confirmed", "Signed scope, success criteria and test data route agreed."),
            ("Demonstration working", "Bounded demonstration runs on the authorised sample."),
            ("Evaluation report delivered", "Metrics measured on a held-out set; go / no-go recorded."),
        ],
        "payment": "Proposed default: 50% on signature, 50% on delivery of the evaluation report (negotiable).",
    },
    Offer.PRODUCTION: {
        "name": "Production AI Engineering",
        "purpose": "Implement an approved workflow in the customer's real operating environment, with the controls needed to run it safely.",
        "customer_inputs": [
            "A signed statement of work.",
            "Completed onboarding.",
            "A named sponsor and operator.",
            "Business rules.",
            "Access through least-privilege named identities.",
            "Participation in user acceptance testing.",
        ],
        "deliverables": [
            "An integrated application or service.",
            "Identity and access controls.",
            "Security and AI evaluation evidence.",
            "Human review and fallback paths.",
            "Deploy, rollback and disable procedures.",
            "Monitoring.",
            "A runbook and operational handover.",
            "A production readiness record.",
        ],
        "exit_criteria": "Contractual acceptance tests pass, customer UAT is signed, and production readiness is approved with business, technical and operational approvals recorded separately.",
        "exclusions": [
            "Support beyond the warranty period stated in the statement of work.",
            "New workflows.",
            "Changes in third-party systems.",
            "Data clean-up beyond the agreed sample.",
            "Autonomous financial actions (payments, postings) without human approval.",
        ],
        "milestones": [
            ("Onboarding complete", "Access, data and approvals ready."),
            ("Technical milestone", "An objectively testable milestone agreed in the statement of work."),
            ("Acceptance", "Acceptance tests pass and UAT is signed."),
        ],
        "payment": "Proposed default: 40% on signature, 40% at an agreed technical milestone, 20% on acceptance (negotiable).",
    },
    Offer.MANAGED: {
        "name": "Managed AI Operations",
        "purpose": "Operate, monitor, maintain and improve a deployed solution within defined service terms.",
        "customer_inputs": [
            "An accepted production system.",
            "A named customer contact.",
            "Agreement on coverage hours, alert routing and change approvals.",
        ],
        "deliverables": [
            "Defined support coverage.",
            "Monitoring and alerting.",
            "An incident procedure.",
            "A monthly report.",
            "Agreed maintenance.",
            "A bounded improvement allowance.",
        ],
        "exit_criteria": "Each month the report is delivered and incidents are handled per contract. On termination, offboarding is completed.",
        "exclusions": [
            "Unlimited support.",
            "Round-the-clock staffed response unless separately funded and actually staffed.",
            "New features beyond the improvement allowance.",
            "Third-party subscription costs unless stated.",
        ],
        "milestones": [
            ("Service start", "Coverage, alert routing and change approvals agreed."),
            ("First monthly report", "Report delivered and reviewed with the customer."),
        ],
        "payment": "Monthly in advance; minimum term and notice period per contract.",
    },
}

#: Standing notes on every proposal draft.
PROPOSAL_NOTES = (
    "Prices exclude VAT. Whether VAT applies depends on the registration status: confirm before sending.",
    "This is a draft for the owner to review. It has not been sent, and nothing here is a commitment until a scope is signed.",
    "Commercial and legal wording needs qualified review before use (AID-014).",
)


def definition(offer: str) -> dict | None:
    return OFFER_DEFINITIONS.get(offer)


# Offer-based discovery questions, used when AI is unavailable and as the base the model tailors.
BASE_QUESTIONS = (
    (
        "What is the workflow, from the first trigger to the last step?",
        "Without the steps there is nothing to map or measure.",
    ),
    ("Who does it today, and how much of their week does it take?", "Volume and effort give the baseline."),
    (
        "Which systems, files or inboxes are involved?",
        "Shows where data lives and what an integration would touch.",
    ),
    ("What goes wrong now, and what does it cost when it does?", "Separates real pain from a nice-to-have."),
    ("What would good look like in numbers (time, errors, cost)?", "Becomes the acceptance criteria."),
    (
        "What data is involved, and is any of it personal or sensitive?",
        "Decides the data and security route.",
    ),
    (
        "Who decides, and who must approve the result before it is used?",
        "Names the sponsor and the human review.",
    ),
)
OFFER_QUESTIONS = {
    Offer.ASSESSMENT: (
        (
            "Could a simpler fix (a rule, a template, a different tool) solve this?",
            "The assessment must consider non-AI options.",
        ),
        ("Can we watch one real run of the process?", "An observed run beats a description."),
    ),
    Offer.PROOF_OF_VALUE: (
        (
            "Can you provide representative sample data through an approved route?",
            "A proof of value needs authorised data.",
        ),
        ("Who can label what the correct result is for a sample?", "Needed to measure accuracy."),
        (
            "What result would make you say go, and what would make you say stop?",
            "Agreed before the work starts.",
        ),
    ),
    Offer.PRODUCTION: (
        (
            "Which systems must it write to, and with what access?",
            "Least-privilege identities are needed up front.",
        ),
        (
            "What is the fallback when it is wrong or unavailable?",
            "Production needs a human fallback and a disable path.",
        ),
        (
            "Who will operate it after handover?",
            "Decides the runbook and whether managed operations is needed.",
        ),
    ),
    Offer.MANAGED: (
        (
            "What hours must it be covered, and who is alerted?",
            "Support must match what Vitalos can actually staff.",
        ),
        ("What changes do you expect each month?", "Sizes the improvement allowance."),
    ),
}


def template_questions(offer: str = "") -> list[dict]:
    """Offer-based discovery questions (no AI). Ids are stable so answers survive a regenerate."""
    pairs = [*BASE_QUESTIONS, *OFFER_QUESTIONS.get(offer, ())]
    return [
        {"id": f"q{index}", "question": question, "why": why, "answer": "", "status": "open"}
        for index, (question, why) in enumerate(pairs, start=1)
    ]
