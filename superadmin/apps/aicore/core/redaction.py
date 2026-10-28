"""Redaction for logs and error messages (CORE-05). Prompts and outputs are never logged at INFO.

``redact`` masks email addresses, IBAN-like strings, card/account-like digit runs and phone numbers.
It is a safety net for operational logs, not an anonymisation tool for datasets.
"""

from __future__ import annotations

import re

_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_IBAN = re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b")
# International or UK-style phone numbers: +44 20 7946 0000, 020 7946 0000, 07700 900123.
_PHONE = re.compile(r"(?<![\w.])(?:\+\d{1,3}[\s-]?)?(?:\(0\)\s?)?\d{2,5}[\s-]\d{3,4}[\s-]?\d{3,4}(?![\w.])")
# Eight or more digits, optionally grouped by spaces or dashes (account and card numbers).
_DIGITS = re.compile(r"(?<![\w.])\d(?:[ -]?\d){7,}(?![\w.])")


def redact(text: str) -> str:
    if not text:
        return ""
    text = _EMAIL.sub("[email]", text)
    text = _IBAN.sub("[iban]", text)
    text = _PHONE.sub("[phone]", text)
    return _DIGITS.sub(_number, text)


_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def _number(match: re.Match) -> str:
    """Mask long digit runs, but keep ISO dates readable (2026-09-03 is not an account number)."""
    return match.group(0) if _ISO_DATE.fullmatch(match.group(0)) else "[number]"


def safe_detail(text: str, limit: int = 200) -> str:
    """A redacted, length-limited string for error categories and log fields."""
    return redact(text)[:limit]
