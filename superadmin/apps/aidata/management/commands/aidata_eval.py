"""Run the workspace reliability cases (offline) and enforce the gate.

    python manage.py aidata_eval --out /tmp/aidata-eval

Needs no database, network or key. The cases use hand-written simulated model responses, so a pass is
reliability evidence only, never evidence of live model quality (see apps/aidata/evaluation.py).
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.aidata import evaluation


class Command(BaseCommand):
    help = "Run the AI & Data workspace reliability cases and write report.json and report.md."

    def add_arguments(self, parser):
        parser.add_argument(
            "--out", action="append", default=[], help="Directory for report.json and report.md."
        )

    def handle(self, *args, out=(), **options):
        summary = evaluation.run_all()
        markdown = evaluation.render_markdown(summary)
        for directory in out:
            target = Path(directory)
            target.mkdir(parents=True, exist_ok=True)
            (target / "report.json").write_text(
                json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
            )
            (target / "report.md").write_text(markdown, encoding="utf-8")
        self.stdout.write(markdown)
        if not summary["passed_gate"]:
            raise CommandError("The workspace reliability gate failed.")
