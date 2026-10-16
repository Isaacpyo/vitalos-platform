"""Production checks for the Insights and Careers settings (prod.py fails at startup on any problem).

Pure Python, no Django imports, so the settings module can call it. Every value may be empty, which
leaves the feature off. Messages name the setting and key id, never a secret.
"""

import re

KEY_ID_RE = re.compile(r"[a-z0-9-]{1,32}", re.ASCII)
MIN_SECRET = 32
KEY_SETTINGS = (
    "CONTENT_READ_CLIENT_KEYS",
    "CAREERS_SUBMIT_CLIENT_KEYS",
    "CONTENT_REVALIDATE_SECRET",
    "CONTENT_RENDER_SECRET",
    "CONTENT_PREVIEW_SECRET",
)


def problems(values: dict) -> list[str]:
    found = []
    for name in KEY_SETTINGS:
        raw = (values.get(name) or "").strip()
        if not raw:
            continue
        for index, entry in enumerate(raw.split(","), start=1):
            key_id, sep, secret = entry.strip().partition(":")
            if not sep or not KEY_ID_RE.fullmatch(key_id):
                found.append(
                    f"{name}: entry {index} must be keyId:secret with a key id matching [a-z0-9-]{{1,32}}."
                )
            elif len(secret) < MIN_SECRET:
                found.append(
                    f"{name}: the secret for key id {key_id} must be at least {MIN_SECRET} characters."
                )
    for target in values.get("CONTENT_WEB_TARGETS") or []:
        if not str(target).startswith("https://"):
            found.append("CONTENT_WEB_TARGETS: every website target must be an https:// URL.")
            break
    if (values.get("CAREERS_SUBMIT_CLIENT_KEYS") or "").strip():
        salt = values.get("CONTENT_IP_SALT") or ""
        if len(salt) < MIN_SECRET:
            found.append(
                f"CONTENT_IP_SALT: required (at least {MIN_SECRET} characters) when CAREERS_SUBMIT_CLIENT_KEYS is set."
            )
    return found
