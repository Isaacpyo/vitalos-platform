"""Proposal export as Markdown (and the data for the print view). Nothing is sent: the owner sends it manually."""

from __future__ import annotations

from .models import Draft, DraftState


def _bullets(items) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "_None stated._"


def price_line(price: dict) -> str:
    kind = (price or {}).get("kind")
    if kind == "offer_price":
        return f"{price['label']} (excl. VAT). {price['note']}"
    if kind == "estimate":
        return f"{price['label']} (excl. VAT). {price['note']}"
    return "Price to be confirmed."


def proposal_markdown(draft: Draft) -> str:
    p = draft.payload
    opportunity = draft.opportunity
    ready = draft.state == DraftState.APPROVED
    lines = [
        f"# {p.get('title', 'Proposal')}",
        "",
        f"**Status: {'Approved for sending by the owner' if ready else 'DRAFT: not approved'}.** "
        f"{opportunity.ref}, proposal version {draft.version}, based on approved discovery v{p.get('discovery_version', '?')}.",
        "",
        "> This document has not been sent. Nothing in it is a commitment until a scope is signed.",
        "",
        "## Summary",
        "",
        p.get("summary") or "_Not stated._",
        "",
        "## Scope",
        "",
        _bullets(p.get("scope")),
        "",
        "## Deliverables",
        "",
        _bullets(p.get("deliverables")),
        "",
        "## Exclusions",
        "",
        _bullets(p.get("exclusions")),
        "",
        "## Dependencies and what we need from you",
        "",
        _bullets(p.get("dependencies")),
        "",
        "## Milestones",
        "",
    ]
    milestones = p.get("milestones", [])
    if milestones:
        for index, item in enumerate(milestones, start=1):
            target = f" (target: {item['target']})" if item.get("target") else ""
            lines.append(f"{index}. **{item['name']}**{target}: {item.get('description', '')}")
    else:
        lines.append("_None stated._")
    lines += [
        "",
        "## Acceptance criteria",
        "",
        _bullets(p.get("acceptance_criteria")),
        "",
        "## Price",
        "",
        price_line(p.get("price", {})),
        "",
    ]
    if p.get("payment"):
        lines += ["**Payment:** " + p["payment"], ""]
    lines += ["## Notes", "", _bullets(p.get("notes")), ""]
    return "\n".join(lines)
