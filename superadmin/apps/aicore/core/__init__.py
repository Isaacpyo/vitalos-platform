"""Vitalos AI Engineering Core (pure Python).

Nothing in this package imports Django, so it can be mounted in another service (for example a
FastAPI app for a client engagement, AID-009). The Django layer in ``apps.aicore`` supplies settings,
metering storage and audit around it.

Modules: ``providers`` (model provider interface and adapters), ``prompts`` (versioned prompt
configurations), ``gateway`` (structured execution with validation, retries and metering),
``limits`` (kill switch, call/run/budget caps), ``pricing`` (cost estimates), ``redaction`` (safe
logging) and ``evaluation`` (versioned datasets, scorers, release gates and reports).
"""
