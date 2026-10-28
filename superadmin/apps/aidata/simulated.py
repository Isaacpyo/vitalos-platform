"""A hand-written simulated provider for the workspace (development screenshots and tests only).

It answers each workspace prompt with a response derived from the input by the same rules the
non-AI path uses, in the shape the prompt's schema requires. It says nothing about how a real model
performs: every response is marked ``simulated`` and the UI labels it "Simulated AI". It is used only
when ``DEBUG`` and ``AI_DATA_SIMULATED_PROVIDER`` are both on, or when a test installs it.
"""

from __future__ import annotations

from apps.aicore.core.prompts import DATA_CLOSE, DATA_OPEN
from apps.aicore.core.providers import ModelRequest, SimulatedProvider

from . import catalog, discovery, extraction


def data_block(request: ModelRequest) -> str:
    text = request.messages[-1]["content"]
    start = text.find(DATA_OPEN)
    end = text.rfind(DATA_CLOSE)
    if start < 0 or end < 0:
        return ""
    return text[start + len(DATA_OPEN) : end].strip("\n")


def respond(request: ModelRequest) -> dict:
    data = data_block(request)
    ref = request.prompt_ref
    if ref.startswith("brief_extract"):
        result = extraction.extract(data)
        names = {
            "organisation",
            "contact_name",
            "contact_role",
            "sector",
            "problem_summary",
            "desired_outcome",
            "current_tools",
            "timeframe",
        }
        return {
            "respond": {
                "fields": [
                    {"name": e.field, "value": result.fields[e.field], "quote": e.quote[:800]}
                    for e in result.evidence
                    if e.field in names and result.fields.get(e.field)
                ],
                "offer": {"value": result.offer.value, "reasons": result.offer.reasons[:2]},
                "next_action": {
                    "value": result.next_action.value[:300],
                    "reasons": result.next_action.reasons[:2],
                },
                "unclear": [],
            }
        }
    if ref.startswith("discovery_questions"):
        questions = catalog.template_questions()[:6]
        return {"respond": {"questions": [{"question": q["question"], "why": q["why"]} for q in questions]}}
    if ref.startswith("discovery_pack"):
        pack = discovery.from_notes(data)
        slim = {
            "summary": "Simulated summary of the supplied notes.",
            "workflow_steps": [
                {k: step.get(k, "") for k in ("actor", "system", "input", "output", "action", "quote")}
                for step in pack["workflow_steps"]
            ],
            "contradictions": [],
        }
        for kind in discovery.LIST_KEYS:
            slim[kind] = [{"text": item["text"], "quote": item["quote"]} for item in pack[kind]]
        return {"respond": slim}
    if ref.startswith("opportunity_qa"):
        return {"respond": {"answerable": False, "answer": "", "citations": []}}
    if ref.startswith("brief_questions"):
        return {
            "respond": {
                "questions": [
                    {
                        "id": "q1",
                        "question": "Who does this today, and how long does it take?",
                        "why": "Gives a baseline.",
                        "suggestions": ["One person", "A small team"],
                    },
                    {
                        "id": "q2",
                        "question": "Which tools or files are involved?",
                        "why": "Shows where the data lives.",
                        "suggestions": [],
                    },
                ]
            }
        }
    if ref.startswith("brief_draft"):
        return {
            "respond": {
                "current_workflow": data[:300],
                "desired_outcome": "",
                "possible_automation": [],
                "unknowns": ["Volumes are not stated."],
                "suggested_next_step": "Talk through the steps with someone who does them.",
            }
        }
    return {"fault": "rejected"}


class WorkspaceSimulatedProvider(SimulatedProvider):
    def __init__(self):
        super().__init__(responder=respond)
