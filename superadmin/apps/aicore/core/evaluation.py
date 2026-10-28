"""Evaluation harness (CORE-04): versioned datasets, pluggable scorers, release gates and reports.

* ``load_dataset`` reads ``<root>/<version>/<split>/<case>/`` (``case.json``, ``expected.json`` and
  input files) and hashes every file, so a report names exactly what it ran on.
* ``EvalConfig`` is one system-under-test configuration: a runner ``case -> output dict`` plus a
  description whose hash identifies it. ``simulated`` marks configurations that use hand-written
  model responses; reports carry that label everywhere.
* Scorers turn (case, output) into counters; counters are summed per configuration and turned into
  metrics. Criteria compare metrics (or anything in the results) against thresholds; a failed
  criterion on a gated configuration fails the gate.
* Determinism: cases run in sorted order, outputs are canonical JSON, wall-clock timings and other
  volatile values (execution ids) are kept apart from the deterministic part, and each gated
  configuration can be run twice to prove the deterministic part is identical.
"""

from __future__ import annotations

import hashlib
import json
import math
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

PASS, FAIL, NOT_RUN = "pass", "fail", "not-run"


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def sha256(text: str | bytes) -> str:
    data = text.encode("utf-8") if isinstance(text, str) else text
    return hashlib.sha256(data).hexdigest()


# --- Dataset ----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class EvalCase:
    id: str
    split: str
    path: Path
    meta: dict
    expected: dict

    def read_bytes(self, name: str) -> bytes:
        return (self.path / name).read_bytes()

    def read_text(self, name: str) -> str:
        return (self.path / name).read_text(encoding="utf-8")

    @property
    def tags(self) -> tuple[str, ...]:
        return tuple(self.meta.get("tags", ()))


@dataclass(frozen=True)
class Dataset:
    name: str
    version: str
    root: Path
    cases: tuple[EvalCase, ...]
    content_hash: str

    def case(self, case_id: str) -> EvalCase:
        for case in self.cases:
            if case.id == case_id:
                return case
        raise KeyError(case_id)


def load_dataset(
    root: Path, version: str, *, name: str = "", splits: Iterable[str] = ("dev", "holdout")
) -> Dataset:
    base = Path(root) / version
    if not base.is_dir():
        raise FileNotFoundError(f"No dataset version {version} under {root}.")
    cases: list[EvalCase] = []
    digest = hashlib.sha256()
    for split in splits:
        split_dir = base / split
        if not split_dir.is_dir():
            continue
        for case_dir in sorted(p for p in split_dir.iterdir() if p.is_dir()):
            meta = json.loads((case_dir / "case.json").read_text(encoding="utf-8"))
            expected = json.loads((case_dir / "expected.json").read_text(encoding="utf-8"))
            case_id = meta.get("id") or case_dir.name
            if case_id != case_dir.name:
                raise ValueError(f"{case_dir}: case.json id {case_id!r} does not match the folder name.")
            cases.append(EvalCase(case_id, split, case_dir, meta, expected))
            for file in sorted(p for p in case_dir.rglob("*") if p.is_file()):
                digest.update(file.relative_to(base).as_posix().encode("utf-8"))
                digest.update(b"\0")
                digest.update(file.read_bytes())
                digest.update(b"\0")
    ids = [case.id for case in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("Case ids must be unique across splits.")
    return Dataset(name or Path(root).name, version, base, tuple(cases), digest.hexdigest())


# --- Configurations and runs ------------------------------------------------------------------------


@dataclass(frozen=True)
class EvalConfig:
    id: str
    label: str
    runner: Callable[[EvalCase], dict]
    description: dict
    simulated: bool = False
    gated: bool = True

    @property
    def config_hash(self) -> str:
        return sha256(canonical({"id": self.id, **self.description}))


@dataclass
class CaseRun:
    case_id: str
    split: str
    output: dict
    volatile: dict
    duration_ms: float
    counters: dict = field(default_factory=dict)


@dataclass
class ConfigResult:
    config: EvalConfig
    runs: list[CaseRun]
    counters: dict
    metrics: dict
    deterministic_hash: str
    reproducible: bool | None = None

    def p95_ms(self, predicate: Callable[[CaseRun], bool] = lambda run: True) -> float:
        values = sorted(run.duration_ms for run in self.runs if predicate(run))
        if not values:
            return 0.0
        index = max(0, math.ceil(0.95 * len(values)) - 1)
        return round(values[index], 2)


Scorer = Callable[[EvalCase, dict, "EvalConfig"], dict]


def run_config(dataset: Dataset, config: EvalConfig, scorers: list[Scorer], metrics_fn) -> ConfigResult:
    runs: list[CaseRun] = []
    totals: dict = {}
    for case in dataset.cases:
        started = time.perf_counter()
        try:
            output = dict(config.runner(case))
        except Exception as error:  # noqa: BLE001 - an unhandled error is a result, not a crash
            output = {"unhandled_error": f"{type(error).__name__}: {error}"[:300]}
        duration_ms = (time.perf_counter() - started) * 1000
        volatile = output.pop("_volatile", {})
        counters: dict = {}
        for scorer in scorers:
            for key, value in scorer(case, output, config).items():
                counters[key] = counters.get(key, 0) + value
        for key, value in counters.items():
            totals[key] = totals.get(key, 0) + value
        runs.append(CaseRun(case.id, case.split, output, volatile, duration_ms, counters))
    digest = sha256(canonical([[run.case_id, run.output, run.counters] for run in runs]))
    result = ConfigResult(config, runs, totals, {}, digest)
    result.metrics = metrics_fn(result)
    return result


# --- Criteria and the report ------------------------------------------------------------------------


@dataclass(frozen=True)
class CriterionResult:
    result: str
    detail: str


@dataclass(frozen=True)
class Criterion:
    id: str
    title: str
    threshold: str
    # Per configuration: returns None when the criterion does not apply to that configuration.
    per_config: Callable[[ConfigResult], CriterionResult | None] | None = None
    # Whole evaluation (reproducibility, security checks, live gate).
    overall: Callable[[Report], CriterionResult] | None = None
    # False for criteria reported separately (the live-provider gate): they never fail the offline gate.
    gating: bool = True


@dataclass
class Report:
    dataset: Dataset
    results: list[ConfigResult]
    criteria: list[Criterion]
    git_sha: str | None
    label: str
    generated_at: str = field(default_factory=lambda: datetime.now(UTC).replace(microsecond=0).isoformat())
    criterion_results: dict = field(default_factory=dict)  # id -> {"overall": CR, "configs": {id: CR}}
    notes: list[str] = field(default_factory=list)
    # Output fields copied into the report per case (the full output is represented by its hash).
    case_keys: tuple[str, ...] = ("state",)

    def evaluate(self) -> Report:
        for criterion in self.criteria:
            per: dict[str, CriterionResult] = {}
            if criterion.per_config is not None:
                for result in self.results:
                    outcome = criterion.per_config(result)
                    if outcome is not None:
                        per[result.config.id] = outcome
            if criterion.overall is not None:
                overall = criterion.overall(self)
            else:
                gated = [per[r.config.id] for r in self.results if r.config.gated and r.config.id in per]
                if not gated:
                    overall = CriterionResult(NOT_RUN, "No gated configuration in this run applies.")
                elif any(item.result == FAIL for item in gated):
                    overall = CriterionResult(FAIL, "; ".join(f"{k}: {v.detail}" for k, v in per.items()))
                elif any(item.result == PASS for item in gated):
                    overall = CriterionResult(PASS, "; ".join(f"{k}: {v.detail}" for k, v in per.items()))
                else:
                    overall = CriterionResult(NOT_RUN, "; ".join(f"{k}: {v.detail}" for k, v in per.items()))
            self.criterion_results[criterion.id] = {"overall": overall, "configs": per}
        return self

    def result(self, config_id: str) -> ConfigResult:
        for result in self.results:
            if result.config.id == config_id:
                return result
        raise KeyError(config_id)

    def gate_passed(self) -> bool:
        """False when any gating criterion failed (per-config criteria only count gated configs)."""
        return not self.failed_criteria()

    def failed_criteria(self) -> list[str]:
        return [
            c.id for c in self.criteria if c.gating and self.criterion_results[c.id]["overall"].result == FAIL
        ]

    # -- serialisation --

    def deterministic(self) -> dict:
        """Everything except timings, timestamps and volatile ids: identical for identical inputs."""
        return {
            "dataset": {
                "name": self.dataset.name,
                "version": self.dataset.version,
                "content_hash": self.dataset.content_hash,
                "cases": len(self.dataset.cases),
                "splits": sorted({case.split for case in self.dataset.cases}),
            },
            "label": self.label,
            "configs": [
                {
                    "id": r.config.id,
                    "label": r.config.label,
                    "simulated": r.config.simulated,
                    "gated": r.config.gated,
                    "config_hash": r.config.config_hash,
                    "description": r.config.description,
                    "metrics": {k: v for k, v in r.metrics.items() if not k.endswith("_ms")},
                    "counters": dict(sorted(r.counters.items())),
                    "outputs_hash": r.deterministic_hash,
                    "cases": [
                        {
                            "id": run.case_id,
                            "split": run.split,
                            "output": {k: run.output[k] for k in self.case_keys if k in run.output},
                            "output_hash": sha256(canonical(run.output)),
                            "counters": run.counters,
                        }
                        for run in r.runs
                    ],
                }
                for r in self.results
            ],
            "criteria": [
                {
                    "id": c.id,
                    "title": c.title,
                    "threshold": c.threshold,
                    "gating": c.gating,
                    "result": self.criterion_results[c.id]["overall"].result,
                    "detail": self.criterion_results[c.id]["overall"].detail,
                    "configs": {
                        cid: {"result": cr.result, "detail": cr.detail}
                        for cid, cr in sorted(self.criterion_results[c.id]["configs"].items())
                    },
                }
                for c in self.criteria
            ],
            "notes": list(self.notes),
        }

    def deterministic_hash(self) -> str:
        return sha256(canonical(self.deterministic()))

    def to_json(self) -> dict:
        body = self.deterministic()
        return {
            "schema": "vitalos.evaluation.report/1",
            "generated_at": self.generated_at,
            "git_sha": self.git_sha,
            "deterministic_hash": self.deterministic_hash(),
            **body,
            "timings": {
                r.config.id: {
                    "p95_ms": r.p95_ms(),
                    "metrics": {k: v for k, v in r.metrics.items() if k.endswith("_ms")},
                    "cases": {run.case_id: round(run.duration_ms, 2) for run in r.runs},
                    "volatile": {run.case_id: run.volatile for run in r.runs if run.volatile},
                }
                for r in self.results
            },
        }

    def to_markdown(
        self, *, compare: tuple[str, str] | None = None, metric_labels: dict | None = None
    ) -> str:
        """Human-readable report: provenance, criteria per configuration, metrics side by side, cases."""
        metric_labels = metric_labels or {}
        ids = [r.config.id for r in self.results]
        lines = [
            f"# Evaluation report: {self.dataset.name} {self.dataset.version}",
            "",
            f"**{self.label}.**",
            "",
            "| Field | Value |",
            "| --- | --- |",
            f"| Generated | {self.generated_at} |",
            f"| Git commit | `{self.git_sha or 'unknown'}` |",
            f"| Dataset | {self.dataset.name} {self.dataset.version}, {len(self.dataset.cases)} cases, "
            f"content hash `{self.dataset.content_hash[:16]}` |",
            f"| Deterministic hash | `{self.deterministic_hash()[:16]}` (timings and ids excluded) |",
        ]
        for r in self.results:
            tags = [
                "simulated model responses" if r.config.simulated else "",
                "gated" if r.config.gated else "not gated",
            ]
            lines.append(
                f"| Config `{r.config.id}` | {r.config.label}; hash `{r.config.config_hash[:16]}`; "
                f"{'; '.join(t for t in tags if t)} |"
            )
        if any(r.config.simulated for r in self.results):
            lines += [
                "",
                "> Simulated configurations use hand-written model responses (test doubles). They test the "
                "controls around the model, not model quality, and are not evidence that a live provider works.",
            ]
        lines += [
            "",
            "## Criteria",
            "",
            "| ID | Criterion | Threshold | " + " | ".join(f"`{i}`" for i in ids) + " | Result |",
        ]
        lines.append("| --- | --- | --- | " + " | ".join("---" for _ in ids) + " | --- |")
        for c in self.criteria:
            entry = self.criterion_results[c.id]
            cells = [entry["configs"][i].result if i in entry["configs"] else "–" for i in ids]
            result = entry["overall"].result + ("" if c.gating else " (separate gate)")
            lines.append(
                f"| {c.id} | {c.title} | {c.threshold} | " + " | ".join(cells) + f" | **{result}** |"
            )
        lines += ["", "### Criterion details", ""]
        for c in self.criteria:
            lines.append(f"- **{c.id}**: {self.criterion_results[c.id]['overall'].detail}")
        lines += ["", "## Metrics", "", "| Metric | " + " | ".join(f"`{i}`" for i in ids) + " |"]
        lines.append("| --- | " + " | ".join("---:" for _ in ids) + " |")
        keys = [k for k in self.results[0].metrics if not k.endswith("_ms")] if self.results else []
        for key in keys:
            values = [r.metrics.get(key) for r in self.results]
            lines.append(
                f"| {metric_labels.get(key, key)} | "
                + " | ".join("n/a" if v is None else str(v) for v in values)
                + " |"
            )
        lines.append(
            "| p95 duration per case, ms (this machine; not part of the deterministic hash) | "
            + " | ".join(str(r.p95_ms()) for r in self.results)
            + " |"
        )
        lines += ["", "## Cases", "", "| Case | Split | " + " | ".join(f"`{i}`" for i in ids) + " |"]
        lines.append("| --- | --- | " + " | ".join("---" for _ in ids) + " |")
        for index, case in enumerate(self.dataset.cases):
            states = [str(r.runs[index].output.get("state", "?")) for r in self.results]
            lines.append(f"| {case.id} | {case.split} | " + " | ".join(states) + " |")
        if compare:
            left, right = self.result(compare[0]), self.result(compare[1])
            lines += ["", f"## Comparison: `{left.config.id}` vs `{right.config.id}`", ""]
            different = [
                (a.case_id, a.output.get("state"), b.output.get("state"))
                for a, b in zip(left.runs, right.runs, strict=True)
                if canonical(a.output) != canonical(b.output)
            ]
            if not different:
                lines.append("Identical outputs on every case.")
            else:
                lines += ["| Case | " + f"`{left.config.id}` | `{right.config.id}` |", "| --- | --- | --- |"]
                lines += [f"| {case_id} | {a} | {b} |" for case_id, a, b in different]
        if self.notes:
            lines += ["", "## Notes", ""] + [f"- {note}" for note in self.notes]
        return "\n".join(lines) + "\n"


def _stable_metrics(result: ConfigResult) -> dict:
    return {key: value for key, value in result.metrics.items() if not key.endswith("_ms")}


def evaluate(
    dataset: Dataset,
    configs: list[EvalConfig],
    *,
    scorers: list[Scorer],
    metrics_fn,
    criteria: list[Criterion],
    label: str,
    git_sha: str | None = None,
    repeat_gated: bool = True,
    case_keys: tuple[str, ...] = ("state",),
) -> Report:
    """Run every configuration, repeat gated ones to prove determinism, then apply the criteria.

    Metric names ending in ``_ms`` are timings: reported, but excluded from the deterministic part.
    """
    results = []
    for config in configs:
        result = run_config(dataset, config, scorers, metrics_fn)
        if repeat_gated and config.gated:
            again = run_config(dataset, config, scorers, metrics_fn)
            result.reproducible = again.deterministic_hash == result.deterministic_hash and _stable_metrics(
                again
            ) == _stable_metrics(result)
        results.append(result)
    return Report(dataset, results, criteria, git_sha, label, case_keys=case_keys).evaluate()


def find_git_sha(start: Path) -> str | None:
    """HEAD commit from the nearest .git (works in worktrees), without running git."""
    for directory in [Path(start).resolve(), *Path(start).resolve().parents]:
        dot_git = directory / ".git"
        if dot_git.is_file():
            text = dot_git.read_text(encoding="utf-8").strip()
            if not text.startswith("gitdir:"):
                return None
            git_dir = (directory / text.split(":", 1)[1].strip()).resolve()
        elif dot_git.is_dir():
            git_dir = dot_git
        else:
            continue
        common = git_dir
        if (git_dir / "commondir").is_file():
            common = (git_dir / (git_dir / "commondir").read_text(encoding="utf-8").strip()).resolve()
        try:
            head = (git_dir / "HEAD").read_text(encoding="utf-8").strip()
        except OSError:
            return None
        if not head.startswith("ref:"):
            return head or None
        ref = head.split(":", 1)[1].strip()
        for base in (git_dir, common):
            ref_file = base / ref
            if ref_file.is_file():
                return ref_file.read_text(encoding="utf-8").strip() or None
        packed = common / "packed-refs"
        if packed.is_file():
            for line in packed.read_text(encoding="utf-8").splitlines():
                parts = line.split()
                if len(parts) == 2 and parts[1] == ref:
                    return parts[0]
        return None
    return None
