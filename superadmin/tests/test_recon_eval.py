"""Evaluation harness and gate: determinism, failure of a deliberately broken configuration, the
website summary shape, the committed report and the management command."""

import json
import re
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

from apps.aicore.core.evaluation import EvalConfig, evaluate, load_dataset
from apps.recon_demo import evaluation_suite as suite
from apps.recon_demo import selectors, statement_model
from apps.recon_demo.security_checks import run_security_checks

REPO_DOCS = Path(__file__).resolve().parents[2] / "docs" / "ai-data" / "evaluation" / "v1"


def run(configs, security=None):
    dataset = load_dataset(suite.DATASET_ROOT, "v1", name="recon_demo")
    cases = {case.id: case for case in dataset.cases}
    return evaluate(
        dataset,
        configs,
        scorers=[suite.score],
        metrics_fn=suite.metrics,
        criteria=suite.criteria(cases, security),
        label=suite.LABEL,
        git_sha="test",
    )


def test_dataset_is_versioned_split_and_synthetic():
    dataset = load_dataset(suite.DATASET_ROOT, "v1")
    assert {case.split for case in dataset.cases} == {"dev", "holdout"}
    assert 16 <= len(dataset.cases) <= 30
    for case in dataset.cases:
        assert case.meta["synthetic"] is True
        text = (case.read_bytes("statement.txt") + case.read_bytes("ledger.csv")).decode(
            "utf-8", errors="ignore"
        )
        for domain in re.findall(r"[\w.+-]+@([\w.-]+)", text):
            assert domain.endswith(".example"), case.id  # fictional addresses only
        if case.meta.get("simulated_script"):
            assert "model-path" in case.tags


def test_two_runs_give_identical_deterministic_reports():
    first = run(suite.build_configs([suite.RULES_ONLY, suite.SIMULATED]))
    second = run(suite.build_configs([suite.RULES_ONLY, suite.SIMULATED]))
    assert first.deterministic_hash() == second.deterministic_hash()
    assert all(result.reproducible for result in first.results)
    assert first.criterion_results["AC-12"]["overall"].result == "pass"


def test_offline_gate_passes_and_live_is_not_run():
    report = run(suite.build_configs([suite.RULES_ONLY, suite.SIMULATED]), run_security_checks)
    assert report.gate_passed(), report.failed_criteria()
    assert report.criterion_results["AC-14"]["overall"].result == "not-run"
    for cid in [f"AC-{n}" for n in range(1, 14)]:
        assert report.criterion_results[cid]["overall"].result == "pass", cid


def test_broken_grounding_fails_the_gate(monkeypatch):
    def accept_everything(item, sent, keys):
        from apps.recon_demo.statement_rules import StatementLine
        from apps.recon_demo.values import parse_amount, parse_date

        return StatementLine(
            item["source_line"],
            parse_date(item["date"]),
            item["reference"],
            item["type"],
            parse_amount(item["amount"]),
            "model",
        ), ""

    monkeypatch.setattr(statement_model, "ground", accept_everything)
    report = run(suite.build_configs([suite.SIMULATED]))
    assert not report.gate_passed()
    assert "AC-3" in report.failed_criteria()


def test_a_broken_configuration_fails_on_states():
    def always_completed(case):
        return {"state": "COMPLETED", "lines": [], "model_calls": 0, "recorded": {"x": True}}

    broken = EvalConfig("broken", "Always says completed", always_completed, {"broken": True}, gated=True)
    report = run([broken])
    failed = report.failed_criteria()
    assert "AC-6" in failed and "AC-7" in failed and not report.gate_passed()


def test_unhandled_error_is_a_result_not_a_crash():
    def explode(case):
        raise RuntimeError("boom")

    report = run([EvalConfig("explode", "Raises", explode, {}, gated=True)])
    assert "AC-1" in report.failed_criteria() or "AC-6" in report.failed_criteria()
    assert report.results[0].counters["unhandled_errors"] == len(report.dataset.cases)


def test_web_summary_has_the_agreed_shape():
    report = run(suite.build_configs([suite.RULES_ONLY, suite.SIMULATED]), run_security_checks)
    summary = suite.web_summary(report)
    assert list(summary) == [
        "schemaVersion",
        "status",
        "generatedAt",
        "gitSha",
        "datasetVersion",
        "label",
        "configs",
        "criteria",
    ]
    assert (
        summary["schemaVersion"] == 1
        and summary["status"] == "published"
        and summary["datasetVersion"] == "v1"
    )
    assert summary["label"] == "Offline evaluation on synthetic data"
    metric_keys = [
        "cases",
        "fieldAccuracy",
        "lineRecall",
        "linePrecision",
        "exceptionRecall",
        "exceptionPrecision",
        "stateAccuracy",
        "unsafeAccepts",
        "p95DurationMs",
        "costPerCaseGbp",
    ]
    for config in summary["configs"]:
        assert list(config) == ["id", "label", "simulated", "metrics"]
        assert list(config["metrics"]) == metric_keys
    assert [c["simulated"] for c in summary["configs"]] == [False, True]
    assert [c["id"] for c in summary["criteria"]] == [f"AC-{n}" for n in range(1, 15)]
    assert all(set(c) == {"id", "title", "threshold", "result", "detail"} for c in summary["criteria"])
    assert summary["criteria"][-1]["result"] == "not-run"


def test_security_checks_pass():
    assert run_security_checks().result == "pass"


def test_command_writes_reports_and_passes_the_gate(tmp_path):
    out, web = tmp_path / "eval", tmp_path / "web" / "summary.json"
    call_command(
        "recon_eval",
        "--dataset",
        "v1",
        "--config",
        "rules-only",
        "--config",
        "rules+simulated-model",
        "--compare",
        "rules-only,rules+simulated-model",
        "--out",
        str(out),
        "--web-report",
        str(web),
    )
    report = json.loads((out / "report.json").read_text())
    assert report["dataset"]["version"] == "v1" and report["git_sha"]
    assert all(c["config_hash"] for c in report["configs"])
    markdown = (out / "report.md").read_text()
    assert "Simulated configurations use hand-written model responses" in markdown
    assert "## Comparison" in markdown
    assert json.loads(web.read_text())["status"] == "published"


def test_command_exits_non_zero_when_the_gate_fails(monkeypatch, tmp_path):
    monkeypatch.setattr(statement_model, "ground", lambda item, sent, keys: (None, "broken"))
    with pytest.raises(CommandError, match="gate failed"):
        call_command("recon_eval", "--config", "rules+simulated-model", "--out", str(tmp_path))


def test_live_configuration_needs_a_key_and_a_cap(settings, monkeypatch):
    monkeypatch.delenv("CI", raising=False)
    with pytest.raises(CommandError, match="max-calls"):
        call_command("recon_eval", "--config", "rules+live-model")
    with pytest.raises(CommandError, match="AI_DATA_LLM_API_KEY"):
        call_command("recon_eval", "--config", "rules+live-model", "--max-calls", "5")
    monkeypatch.setenv("CI", "true")
    with pytest.raises(CommandError, match="never runs in ordinary CI"):
        call_command("recon_eval", "--config", "rules+live-model", "--max-calls", "5")


def test_committed_report_is_current_and_labelled():
    report = selectors.latest_report()
    assert report is not None, "commit the report: recon_eval --out apps/recon_demo/reports/v1"
    current = load_dataset(suite.DATASET_ROOT, "v1")
    assert report["dataset"]["content_hash"] == current.content_hash, "dataset changed: re-run recon_eval"
    assert {c["id"]: c["simulated"] for c in report["configs"]} == {
        "rules-only": False,
        "rules+simulated-model": True,
    }
    assert {c["id"]: c["result"] for c in report["criteria"]}["AC-14"] == "not-run"
    docs = REPO_DOCS / "report.json"
    if docs.is_file():  # the docs copy is outside the container image; check it when present
        assert json.loads(docs.read_text())["deterministic_hash"] == report["deterministic_hash"]
