"""Reliability cases for the workspace prompts (ADR-055). Offline: no database, no network, no key.

Each case runs a workspace prompt through the real gateway (schema validation, limits, retries) with a
hand-written ``SimulatedProvider`` response, then through the same merge and sanitising code the
workspace uses, and checks what a person would be shown: unsupported claims dropped, blanks left blank,
contradictions surfaced, instructions in the source treated as data, provider failures ending in a
recoverable state with the non-AI path intact.

This is RELIABILITY evidence only. The responses are written by hand, so a pass says the controls
around the model work. It says nothing about how well any real model extracts, summarises or drafts,
and there are no live recordings. Live model quality is a separate, unmet evidence requirement.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

from apps.aicore.core.gateway import ModelGateway
from apps.aicore.core.limits import ExecutionLimits, InMemoryUsage, LimitGuard, RunContext
from apps.aicore.core.prompts import load_prompt
from apps.aicore.core.providers import SimulatedProvider

from . import catalog, discovery, extraction, workspace
from .models import Draft, DraftState, Opportunity

CASES_PATH = Path(__file__).resolve().parent / "eval_cases" / "workspace_v1.json"
CATEGORIES = ("incomplete", "contradictory", "unsupported", "injection", "provider_failure", "invalid_json")
LABEL = (
    "RELIABILITY ONLY. Model responses are hand-written test doubles. This shows the controls around "
    "the model work; it is not evidence of live model quality, and no live recordings exist."
)


@dataclass
class CaseResult:
    id: str
    category: str
    prompt: str
    outcome: str
    passed: bool
    failures: list[str] = field(default_factory=list)


def load_cases() -> dict:
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


def _gateway(step: dict):
    provider = SimulatedProvider([step])
    gateway = ModelGateway(
        provider, LimitGuard(ExecutionLimits(), InMemoryUsage()), sleep=lambda _seconds: None
    )
    return provider, gateway


def _count(pack: dict, key: str) -> int:
    return len(pack.get(key, []))


def _check(case: dict, state: dict) -> list[str]:
    expect, failures = case["expect"], []
    dump = json.dumps(state.get("subject", {}), ensure_ascii=False)
    fields = state.get("fields", {})

    def need(ok: bool, message: str):
        if not ok:
            failures.append(message)

    if "outcome" in expect:
        need(
            state["outcome"] == expect["outcome"],
            f"outcome {state['outcome']!r}, wanted {expect['outcome']!r}",
        )
    for name in expect.get("blank", []):
        need(not fields.get(name), f"{name} should be blank, got {fields.get(name)!r}")
    for name, value in expect.get("equals", {}).items():
        need(fields.get(name) == value, f"{name} is {fields.get(name)!r}, wanted {value!r}")
    for name, value in expect.get("rules_fallback_equals", {}).items():
        need(
            state["rules_fields"].get(name) == value,
            f"rules fallback {name} is {state['rules_fields'].get(name)!r}",
        )
    for text in expect.get("contains", []):
        need(text in dump, f"expected {text!r} in the result")
    for text in expect.get("not_contains", []):
        need(text not in dump, f"{text!r} must not appear in the result")
    if "warnings_min" in expect:
        need(
            len(state["warnings"]) >= expect["warnings_min"],
            f"{len(state['warnings'])} warnings, wanted {expect['warnings_min']}",
        )
    for name in expect.get("missing_includes", []):
        need(name in state.get("missing", []), f"{name} should be listed as missing")
    for name in expect.get("unclear_includes", []):
        need(name in state.get("unclear", []), f"{name} should be flagged unclear")
    if "next_action_startswith" in expect:
        need(
            state.get("next_action", "").startswith(expect["next_action_startswith"]),
            f"next action was {state.get('next_action')!r}",
        )
    if "offer_not" in expect:
        need(state.get("offer") != expect["offer_not"], f"offer became {state.get('offer')!r}")
    if "prompt_delimiter_count" in expect:
        need(
            state["prompt"].count("UNTRUSTED_DATA>>>") == expect["prompt_delimiter_count"],
            "the data block can be closed early",
        )
    for text in expect.get("prompt_contains", []):
        need(text in state["prompt"], f"prompt should contain {text!r}")
    for name, count in expect.get("counts", {}).items():
        need(
            _count(state["subject"], name) == count,
            f"{name}: {_count(state['subject'], name)}, wanted {count}",
        )
    for name, count in expect.get("rules_counts", {}).items():
        need(
            _count(state["rules_pack"], name) == count,
            f"rules {name}: {_count(state['rules_pack'], name)}, wanted {count}",
        )
    if expect.get("approval_blocked"):
        need(
            bool(discovery.approval_blockers(state["subject"])),
            "an empty or unsupported pack must not be approvable",
        )
    if "contradictions_min" in expect:
        need(
            len(state["subject"].get("contradictions", [])) >= expect["contradictions_min"],
            "contradictions not surfaced",
        )
    if "template_questions_min" in expect:
        need(len(state["questions"]) >= expect["template_questions_min"], "templates were not used")
    if expect.get("rules_fallback_keeps_text"):
        need(
            bool(state["rules_fields"]) and state["source_unchanged"],
            "the rules path and original text must survive",
        )
    return failures


def _run_model_case(case: dict) -> dict:
    kind, text = case["prompt"], case["text"]
    source, _ = extraction.clean_source(text)
    provider, gateway = _gateway(case["response"])
    variables = {"offer_name": "AI Proof of Value"} if kind == "discovery_questions" else {}
    result = gateway.run_structured(
        load_prompt(kind, 1), data=text, ctx=RunContext("aidata.eval", case["id"]), variables=variables
    )
    state = {
        "outcome": result.outcome,
        "prompt": provider.calls[0].messages[-1]["content"] if provider.calls else "",
        "warnings": [],
        "source_unchanged": source == extraction.clean_source(text)[0],
    }
    rules = extraction.extract(text)
    state["rules_fields"] = dict(rules.fields)
    state["rules_pack"] = discovery.from_notes(text)
    if kind == "brief_extract":
        if result.ok:
            payload, _evidence, warnings = workspace._merge_ai_brief(rules, result.output, source)
        else:
            payload, warnings = workspace._brief_payload(rules), []
        state.update(
            subject=payload["fields"],
            fields=payload["fields"],
            warnings=warnings,
            missing=payload["missing"],
            unclear=payload["unclear"],
            next_action=payload["next_action"]["value"],
            offer=payload["offer"]["value"],
        )
    elif kind == "discovery_pack":
        pack, warnings = (
            discovery.sanitise_ai_pack(result.output, text) if result.ok else (discovery.from_notes(text), [])
        )
        state.update(subject=pack, warnings=warnings)
    else:
        questions = (
            [q["question"] for q in result.output["questions"]]
            if result.ok
            else [q["question"] for q in catalog.template_questions("ai-proof-of-value")]
        )
        state.update(subject={"questions": questions}, questions=questions)
    return state


def _run_proposal_case(case: dict) -> dict:
    text, expect = case["text"], case["expect"]
    pack = discovery.empty_pack()
    pack["summary"] = "Synthetic summary."
    if expect.get("proposal_scope_includes_text"):
        pack["requirements"] = [{"text": text, "quote": "", "start": None, "end": None}]
    else:
        pack["unknowns"] = [{"text": text, "quote": "", "start": None, "end": None}]
    opportunity = Opportunity(title="Eval", organisation="Example Ledger Ltd", offer="ai-proof-of-value")
    basis = Draft(payload=pack, state=DraftState.APPROVED, version=1)
    price = {"kind": "none", "label": "No price yet", "amount": "", "note": "Fixed for the evaluation."}
    proposal = workspace.build_proposal(opportunity, basis, price=price)
    definition = catalog.definition("ai-proof-of-value")
    failures = []
    if expect.get("proposal_scope_includes_text") and text not in proposal["scope"]:
        failures.append("the text was not carried as plain scope data")
    if expect.get("proposal_exclusions_unchanged") and proposal["exclusions"] != definition["exclusions"]:
        failures.append("the exclusions changed")
    if expect.get("proposal_price_unchanged") and proposal["price"] != price:
        failures.append("the price changed")
    if expect.get("proposal_not_approved") and "approved" in proposal:
        failures.append("a proposal must never carry an approval")
    prefix = expect.get("proposal_dependency_prefix")
    if prefix and not any(item.startswith(prefix) for item in proposal["dependencies"]):
        failures.append("an unknown must become 'to be confirmed', not a promise")
    return {"outcome": "built", "failures": failures}


def run_case(case: dict) -> CaseResult:
    if case["prompt"] == "proposal":
        state = _run_proposal_case(case)
        failures = state["failures"]
        outcome = state["outcome"]
    else:
        state = _run_model_case(case)
        failures, outcome = _check(case, state), state["outcome"]
    return CaseResult(case["id"], case["category"], case["prompt"], outcome, not failures, failures)


def run_all() -> dict:
    data = load_cases()
    results = [run_case(case) for case in sorted(data["cases"], key=lambda c: c["id"])]
    by_category = {name: [r for r in results if r.category == name] for name in CATEGORIES}
    gate = [
        ("every case passes", all(r.passed for r in results)),
        ("every category has at least one case", all(by_category[name] for name in CATEGORIES)),
        (
            "the three workspace prompts and the proposal are all covered",
            {r.prompt for r in results}
            >= {"brief_extract", "discovery_pack", "discovery_questions", "proposal"},
        ),
    ]
    summary = {
        "dataset": data["dataset"],
        "label": LABEL,
        "cases": len(results),
        "passed": sum(r.passed for r in results),
        "results": [r.__dict__ for r in results],
        "gate": [{"criterion": name, "passed": ok} for name, ok in gate],
        "passed_gate": all(ok for _name, ok in gate),
    }
    summary["fingerprint"] = hashlib.sha256(
        json.dumps(summary["results"], sort_keys=True).encode()
    ).hexdigest()
    return summary


def render_markdown(summary: dict) -> str:
    lines = [
        f"# AI & Data workspace reliability cases ({summary['dataset']})",
        "",
        f"> **{summary['label']}**",
        "",
        f"Cases: {summary['cases']}. Passed: {summary['passed']}. Gate: {'PASS' if summary['passed_gate'] else 'FAIL'}. Fingerprint `{summary['fingerprint'][:16]}`.",
        "",
        "| Case | Category | Prompt | Gateway outcome | Result |",
        "| --- | --- | --- | --- | --- |",
    ]
    for r in summary["results"]:
        lines.append(
            f"| {r['id']} | {r['category']} | {r['prompt']} | {r['outcome']} | {'pass' if r['passed'] else 'FAIL: ' + '; '.join(r['failures'])} |"
        )
    lines += ["", "## Gate", ""]
    lines += [f"- {'pass' if g['passed'] else 'FAIL'}: {g['criterion']}" for g in summary["gate"]]
    return "\n".join(lines) + "\n"
