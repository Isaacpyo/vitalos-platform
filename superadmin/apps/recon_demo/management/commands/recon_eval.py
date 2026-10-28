"""Evaluate the reconciliation demonstrator on a versioned dataset and enforce the release gate.

    python manage.py recon_eval --dataset v1 --config rules-only --config rules+simulated-model --out /tmp/eval

Offline by default (no database, no network). Exits non-zero when any gating criterion (AC-1 to AC-13)
fails for the gated configurations. ``rules+live-model`` calls the provider in AI_DATA_LLM_* and needs
an explicit ``--max-calls`` hard cap; it never runs in CI and its result is reported as AC-14 only.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.aicore.core.evaluation import evaluate, find_git_sha, load_dataset
from apps.aicore.core.providers import OpenAICompatibleProvider, RecordingProvider
from apps.recon_demo import evaluation_suite as suite
from apps.recon_demo.security_checks import run_security_checks

CHOICES = (suite.RULES_ONLY, suite.SIMULATED, suite.LIVE)
CASE_KEYS = (
    "state",
    "review_kinds",
    "balance",
    "model_calls",
    "max_attempts",
    "error_category",
    "retry_state",
)
METRIC_LABELS = {
    "cases": "Cases",
    "fieldAccuracy": "Field accuracy (parser-supported layouts)",
    "lineRecall": "Line recall",
    "linePrecision": "Line precision",
    "exceptionRecall": "Exception recall",
    "exceptionPrecision": "Exception precision",
    "stateAccuracy": "Final state accuracy",
    "unsafeAccepts": "Unsafe accepts",
    "modelFieldAccuracy": "Model-path field accuracy (simulated responses are not model quality)",
    "modelCalls": "Model calls (attempts)",
    "costPerCaseGbp": "Estimated cost per case (GBP)",
}
MAX_LIVE_CALLS = 200


class Command(BaseCommand):
    help = "Run the demonstrator evaluation (AC-1 to AC-14) and write JSON + Markdown reports."

    def add_arguments(self, parser):
        parser.add_argument("--dataset", default="v1")
        parser.add_argument("--config", action="append", choices=CHOICES, dest="configs")
        parser.add_argument("--compare", default="", help="Two configuration ids, comma-separated.")
        parser.add_argument(
            "--out", action="append", default=[], help="Directory for report.json and report.md."
        )
        parser.add_argument("--web-report", default="", help="Path for the website summary JSON.")
        parser.add_argument("--max-calls", type=int, default=None, help="Hard cap on live provider calls.")
        parser.add_argument("--no-gate", action="store_true", help="Report only; never exit non-zero.")

    def handle(self, *args, **options):
        configs = options["configs"] or [suite.RULES_ONLY, suite.SIMULATED]
        live_factory = None
        live_model = ""
        recorder: list[RecordingProvider] = []
        if suite.LIVE in configs:
            live_factory, live_model = self._live(options["max_calls"], recorder)
        compare = None
        if options["compare"]:
            parts = [part.strip() for part in options["compare"].split(",")]
            if len(parts) != 2 or any(part not in configs for part in parts):
                raise CommandError(
                    "--compare needs two of the configurations being run, e.g. rules-only,rules+simulated-model"
                )
            compare = (parts[0], parts[1])

        dataset = load_dataset(suite.DATASET_ROOT, options["dataset"], name="recon_demo")
        cases = {case.id: case for case in dataset.cases}
        git_sha = os.environ.get("GITHUB_SHA") or find_git_sha(Path(settings.BASE_DIR))
        report = evaluate(
            dataset,
            suite.build_configs(
                configs, live_factory=live_factory, max_calls=options["max_calls"], live_model=live_model
            ),
            scorers=[suite.score],
            metrics_fn=suite.metrics,
            criteria=suite.criteria(cases, run_security_checks),
            label=suite.LABEL,
            git_sha=git_sha,
            case_keys=CASE_KEYS,
        )
        report.notes.append(
            "Dataset v1 is synthetic (fictional suppliers, .example domains). Expected outputs were written from "
            "how each case was constructed, not from the system's output."
        )
        if suite.SIMULATED in configs:
            report.notes.append(
                "rules+simulated-model uses the hand-written responses in each case.json (simulated: true). "
                "It exercises the real gateway, schema validation, grounding, retries and limits."
            )
        if suite.LIVE not in configs:
            report.notes.append(
                "AC-14 (live provider) not run: it needs AI_DATA_LLM_API_KEY and is never inferred offline."
            )

        payload = report.to_json()
        markdown = report.to_markdown(compare=compare, metric_labels=METRIC_LABELS)
        for directory in options["out"]:
            out = Path(directory)
            out.mkdir(parents=True, exist_ok=True)
            (out / "report.json").write_text(
                json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
            )
            (out / "report.md").write_text(markdown, encoding="utf-8")
            if recorder and recorder[0].entries:
                (out / "replay-recordings.json").write_text(
                    json.dumps(recorder[0].export(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
                )
            self.stdout.write(f"Wrote {out / 'report.json'} and {out / 'report.md'}")
        if options["web_report"]:
            path = Path(options["web_report"])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(suite.web_summary(report), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
            )
            self.stdout.write(f"Wrote {path}")

        for criterion in report.criteria:
            entry = report.criterion_results[criterion.id]
            cells = ", ".join(f"{cid} {cr.result}" for cid, cr in entry["configs"].items())
            self.stdout.write(f"{criterion.id:6} {entry['overall'].result:8} {cells}")
        failed = report.failed_criteria()
        if failed and not options["no_gate"]:
            raise CommandError(f"Evaluation gate failed: {', '.join(failed)}")
        self.stdout.write(
            self.style.SUCCESS(
                "Evaluation gate passed." if not failed else "Gate failures reported (--no-gate)."
            )
        )

    def _live(self, max_calls, recorder):
        if os.environ.get("CI") and not os.environ.get("AI_DATA_LIVE_EVAL"):
            raise CommandError(
                "rules+live-model never runs in ordinary CI (use the live evaluation workflow)."
            )
        if getattr(settings, "AI_DATA_DISABLED", False):
            raise CommandError("AI_DATA_DISABLED is set: the live evaluation is switched off.")
        if max_calls is None or not 1 <= max_calls <= MAX_LIVE_CALLS:
            raise CommandError(
                f"rules+live-model needs --max-calls between 1 and {MAX_LIVE_CALLS} (a hard cap)."
            )
        key, base_url, model = (
            settings.AI_DATA_LLM_API_KEY,
            settings.AI_DATA_LLM_BASE_URL,
            settings.AI_DATA_LLM_MODEL,
        )
        if not key:
            raise CommandError("AI_DATA_LLM_API_KEY is not set: the live configuration cannot run.")
        if not base_url or not model:
            raise CommandError(
                "AI_DATA_LLM_BASE_URL and AI_DATA_LLM_MODEL must be set for the live configuration."
            )
        stamp = datetime.now(UTC).date().isoformat()

        def factory():
            if not recorder:
                recorder.append(
                    RecordingProvider(
                        OpenAICompatibleProvider(base_url=base_url, model=model, api_key=key),
                        recorded_at=stamp,
                    )
                )
            return recorder[0]

        return factory, model
