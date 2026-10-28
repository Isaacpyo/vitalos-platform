"""The workspace reliability cases (offline) and the pure readers they rely on. No database is touched.

These are RELIABILITY checks with hand-written model responses; they are not live model-quality evidence.
"""

import pytest
from django.core.management import call_command

from apps.aidata import discovery, evaluation, extraction


def test_the_reliability_gate_passes_and_is_deterministic():
    first, second = evaluation.run_all(), evaluation.run_all()
    assert first["passed_gate"], [r for r in first["results"] if not r["passed"]]
    assert first["fingerprint"] == second["fingerprint"]
    assert first["cases"] >= 20 and "RELIABILITY ONLY" in first["label"]
    categories = {r["category"] for r in first["results"]}
    assert categories >= {
        "incomplete",
        "contradictory",
        "unsupported",
        "injection",
        "provider_failure",
        "invalid_json",
    }


def test_the_command_writes_a_labelled_report(tmp_path, capsys):
    call_command("aidata_eval", "--out", str(tmp_path))
    assert (tmp_path / "report.json").exists()
    report = (tmp_path / "report.md").read_text()
    assert "RELIABILITY ONLY" in report and "Gate: PASS" in report


def test_a_failing_case_fails_the_gate(monkeypatch):
    data = evaluation.load_cases()
    data["cases"][0]["expect"] = {"outcome": "timeout"}
    monkeypatch.setattr(evaluation, "load_cases", lambda: data)
    assert evaluation.run_all()["passed_gate"] is False


GUIDED = """## What you said
We chase customer requests across three inboxes.

## How it works today
Shared mailbox and a spreadsheet.

## What good looks like
One queue and nothing lost.

Name: Pat Example
Email: pat@example.test
Organisation: Pat's Garage Ltd
Topic: customer-requests
"""


def test_headed_sections_from_the_website_brief_are_read_generically():
    result = extraction.extract(GUIDED)
    assert result.guided and result.topic == "customer-requests"
    assert result.fields["problem_summary"] == "We chase customer requests across three inboxes."
    assert result.fields["current_tools"] == "Shared mailbox and a spreadsheet."
    assert result.fields["desired_outcome"] == "One queue and nothing lost."
    assert (
        result.fields["organisation"] == "Pat's Garage Ltd"
        and result.fields["contact_email"] == "pat@example.test"
    )
    assert result.missing == []


def test_labelled_ai_data_form_text_is_read_too():
    text = (
        "Vitalos AI & Data enquiry\nSector: Accounting & bookkeeping\nBusiness problem or workflow:\nStatements are re-keyed.\n"
        "Current tools and process:\nXero\nDesired outcome:\nAutomatic checks\nIndicative budget: £1,000–£5,000 (enquirer's estimate)\n"
    )
    result = extraction.extract(text)
    assert (
        result.fields["sector"] == "accounting-bookkeeping"
        and result.fields["problem_summary"] == "Statements are re-keyed."
    )
    assert result.fields["budget_band"] == "1k-5k" and result.fields["desired_outcome"] == "Automatic checks"


@pytest.mark.parametrize(
    "text",
    [
        GUIDED,
        "Hi, I'm Sam Example from Example Ledger Ltd. Email sam@example-ledger.example. We re-key by hand.",
    ],
)
def test_every_evidence_quote_is_the_exact_source_span(text):
    source, _ = extraction.clean_source(text)
    result = extraction.extract(text)
    assert result.evidence
    for item in result.evidence:
        assert source[item.start : item.end] == item.quote


def test_highlight_segments_cover_the_whole_source_without_overlap():
    text = "Hi, I'm Sam Example from Example Ledger Ltd. sam@example-ledger.example"
    result = extraction.extract(text)
    segments = extraction.highlight_segments(text, [e.as_dict() for e in result.evidence])
    assert "".join(s["text"] for s in segments) == text
    assert any(s["field"] == "contact_email" for s in segments)


def test_nothing_is_invented_from_unstructured_small_talk():
    result = extraction.extract("Hello there, hope you are well!")
    assert not result.fields.get("contact_email") and not result.fields.get("organisation")
    assert {"desired_outcome", "current_tools"} <= set(result.missing)


def test_a_vitalos_address_is_never_taken_as_the_customer_email():
    assert (
        "contact_email"
        not in extraction.extract("cc support@vitalos.co.uk about our spreadsheet problem").fields
    )


def test_long_sources_are_cut_and_flagged():
    result = extraction.extract("We re-key by hand. " * 3000)
    assert result.truncated


def test_notes_are_read_into_a_workflow_with_quotes():
    pack = discovery.from_notes(
        "1. Sam downloads the statement.\n2. Sam re-keys it into Excel.\nIt must flag missing lines.\nNot sure about scans?"
    )
    assert [s["actor"] for s in pack["workflow_steps"]] == ["Sam", "Sam"]
    assert pack["requirements"][0]["text"].startswith("It must flag")
    assert pack["unknowns"] and discovery.approval_blockers(pack)


def test_an_ai_pack_loses_items_it_cannot_quote_but_keeps_assumptions():
    notes = "1. Sam checks statements.\nThe tool must flag mismatches."
    output = {
        "summary": "s",
        "workflow_steps": [
            {"actor": "", "system": "", "input": "", "output": "", "action": "x", "quote": "invented step"}
        ],
        "requirements": [
            {"text": "r", "quote": "invented requirement"},
            {"text": "Flag mismatches", "quote": "must flag mismatches"},
        ],
        "assumptions": [{"text": "a", "quote": ""}],
        "unknowns": [],
        "acceptance_criteria": [],
        "contradictions": [],
    }
    pack, warnings = discovery.sanitise_ai_pack(output, notes)
    assert pack["workflow_steps"] == [] and len(pack["requirements"]) == 1 and len(pack["assumptions"]) == 1
    assert warnings
