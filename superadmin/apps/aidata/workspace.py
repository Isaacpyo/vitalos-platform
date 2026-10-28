"""The AI-assisted delivery workspace (ADR-055): runners for each draft kind, review, approval and history.

Runners are called by ``tasks.execute`` and return an ``Outcome``; they never write the database.
Every other function here is a service (authorise, validate, write, audit). Rules:

* The model proposes, a person decides. Nothing is approved, sent, emailed or published automatically.
* A model value without a quote that is really in the source is dropped (unsupported claim).
* Approved drafts are history. A revision is a new version; approving it supersedes the old one.
* A proposal is built only from an APPROVED discovery pack and the offer definitions; prices come only
  from ``OfferPrice`` (AI & Data > Offers) or an estimate a person typed, labelled as an estimate.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import record
from apps.enquiries import selectors as enquiry_selectors
from apps.enquiries.models import Enquiry

from . import ai, catalog, discovery, extraction, selectors, tasks
from .models import (
    Draft,
    DraftKind,
    DraftMode,
    DraftState,
    Offer,
    OfferPrice,
    Opportunity,
    OpportunitySource,
    Sector,
    Stage,
)

AI_FIELD_NAMES = tuple(extraction.FIELD_LABELS)
NARRATIVE = ("problem_summary", "desired_outcome", "current_tools", "timeframe")
EXACT = ("organisation", "contact_name", "contact_role")


@dataclass
class Outcome:
    payload: dict
    mode: str
    ai_payload: dict = field(default_factory=dict)
    evidence: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    prompt_ref: str = ""
    execution_id: object = None
    simulated: bool = False
    fallback_reason: str = ""


def _require(actor) -> None:
    if not selectors.can_edit_pipeline(actor):
        raise PermissionDenied


# --- Brief ----------------------------------------------------------------------------------------


def _brief_payload(result: extraction.Extraction, unclear=()) -> dict:
    return {
        "fields": dict(result.fields),
        "offer": {
            "value": result.offer.value if result.offer else "",
            "reasons": list(result.offer.reasons) if result.offer else [],
        },
        "next_action": {
            "value": result.next_action.value if result.next_action else "",
            "reasons": list(result.next_action.reasons) if result.next_action else [],
        },
        "missing": list(result.missing),
        "unclear": list(unclear),
        "guided": result.guided,
        "topic": result.topic,
    }


def _merge_ai_brief(result: extraction.Extraction, output: dict, source: str) -> tuple[dict, list, list[str]]:
    """Rules result + validated model output -> (payload, evidence, warnings). Unsupported values are dropped."""
    payload = _brief_payload(result, output.get("unclear", []))
    evidence = [e.as_dict() | {"by": "rules"} for e in result.evidence]
    warnings: list[str] = []
    for item in output.get("fields", []):
        name, value = item["name"], (item["value"] or "").strip()
        span = extraction.find_quote(source, item["quote"])
        if not value or span is None:
            warnings.append(
                f"The model proposed {extraction.FIELD_LABELS.get(name, name).lower()} without a matching quote in the source; it was not kept."
            )
            continue
        quote = source[span[0] : span[1]]
        if name == "sector" and value not in Sector.values:
            continue
        if name in EXACT and value.lower() not in quote.lower():
            warnings.append(
                f"The model's {extraction.FIELD_LABELS[name].lower()} is not in the text it quoted; it was not kept."
            )
            continue
        if payload["fields"].get(name) and name not in NARRATIVE:
            continue  # exact fields matched by rules are never replaced by a model
        payload["fields"][name] = value[: extraction.MAX_VALUE]
        evidence = [e for e in evidence if e["field"] != name]
        evidence.append({"field": name, "quote": quote, "start": span[0], "end": span[1], "by": "ai"})
    offer = output.get("offer") or {}
    if offer.get("value") in Offer.values:
        payload["offer"] = {
            "value": offer["value"],
            "reasons": [r for r in offer.get("reasons", []) if r][:4],
        }
    action = output.get("next_action") or {}
    if (action.get("value") or "").strip():
        payload["next_action"] = {
            "value": action["value"].strip()[:300],
            "reasons": [r for r in action.get("reasons", []) if r][:4],
        }
    payload["missing"] = [n for n in extraction.REQUIRED if not payload["fields"].get(n)]
    if not any(payload["fields"].get(n) for n in extraction.CONTACT_ROUTE):
        payload["missing"].append("contact_email")
    return payload, evidence, warnings


def run_brief(draft: Draft) -> Outcome:
    source = draft.source_text
    result = extraction.extract(source)
    base = _brief_payload(result)
    rules_evidence = [e.as_dict() | {"by": "rules"} for e in result.evidence]
    warnings = ["The source was longer than the limit and was cut."] if result.truncated else []
    if draft.requested_mode != DraftMode.AI:
        return Outcome(base, DraftMode.RULES, evidence=rules_evidence, warnings=warnings)
    try:
        tasks.heartbeat(draft)
        run = ai.run_prompt(
            "brief_extract", 1, data=source, run_ref=f"draft-{draft.pk}", workflow="aidata.brief_extract"
        )
    except ai.AiUnavailable as exc:
        return Outcome(
            base,
            DraftMode.RULES,
            evidence=rules_evidence,
            warnings=warnings,
            fallback_reason=str(exc)[:300] or "AI is unavailable.",
        )
    payload, evidence, merge_warnings = _merge_ai_brief(result, run.output, source)
    return Outcome(
        payload,
        DraftMode.AI,
        ai_payload=run.output,
        evidence=evidence,
        warnings=[*warnings, *merge_warnings],
        prompt_ref=f"{run.prompt_id}@{run.prompt_version}",
        execution_id=run.execution_id,
        simulated=run.simulated,
    )


def prepare_brief(
    *,
    source_text: str,
    source_label: str,
    key: str,
    actor,
    opportunity=None,
    enquiry=None,
    mode=DraftMode.AI,
    request=None,
):
    """Queue (and run) a brief from pasted text. With ``opportunity`` the result later updates that record."""
    _require(actor)
    text, _ = extraction.clean_source(source_text)
    if len(text) < 10:
        raise ValidationError("Paste the enquiry or describe the conversation first.")
    return tasks.submit(
        DraftKind.BRIEF,
        key=key,
        actor=actor,
        opportunity=opportunity,
        enquiry=enquiry,
        source_text=text,
        source_label=source_label,
        requested_mode=mode,
        request=request,
    )


def original_enquiry_text(enquiry) -> str:
    """The first inbound message of ``enquiry`` exactly as received (never modified here)."""
    first = enquiry.messages.filter(direction="inbound").order_by("created_at", "id").first()
    return (first.text_body if first is not None else "") or enquiry.snippet or ""


def prepare_brief_from_enquiry(opportunity: Opportunity, *, key: str, actor, mode=DraftMode.AI, request=None):
    _require(actor)
    enquiry = opportunity.enquiry
    if enquiry is None:
        raise ValidationError("This opportunity has no source enquiry. Paste the text instead.")
    text = original_enquiry_text(enquiry)
    if len(text.strip()) < 10:
        raise ValidationError("The original enquiry has no text to read.")
    return tasks.submit(
        DraftKind.BRIEF,
        key=key,
        actor=actor,
        opportunity=opportunity,
        enquiry=enquiry,
        source_text=text,
        source_label=f"Original enquiry {enquiry.ref}",
        requested_mode=mode,
        request=request,
    )


VIT_REF = re.compile(r"\bVIT-\d{4,}\b", re.IGNORECASE)


def _core_name(name: str) -> str:
    name = re.sub(r"\b(ltd|limited|llp|llc|inc|plc|group|partners)\b\.?", "", (name or "").lower())
    return re.sub(r"[^a-z0-9]+", " ", name).strip()


def find_duplicates(fields: dict, source_text: str = "", exclude: Opportunity | None = None) -> list[dict]:
    """Existing opportunities and enquiries that look like the same customer: by email, organisation or enquiry ref."""
    found: dict[tuple[str, str], dict] = {}

    def add(kind, ref, label, reason, url, opportunity=None, enquiry=None):
        entry = found.setdefault(
            (kind, ref),
            {
                "kind": kind,
                "ref": ref,
                "label": label,
                "url": url,
                "reasons": [],
                "opportunity": opportunity,
                "enquiry": enquiry,
            },
        )
        if reason not in entry["reasons"]:
            entry["reasons"].append(reason)

    email = (fields.get("contact_email") or "").strip().lower()
    org = _core_name(fields.get("organisation", ""))
    opportunities = Opportunity.objects.all()
    if exclude is not None:
        opportunities = opportunities.exclude(pk=exclude.pk)
    if email:
        for item in opportunities.filter(contact_email__iexact=email)[:5]:
            add(
                "opportunity",
                item.ref,
                item.title,
                f"Same email address ({email})",
                item.get_absolute_url(),
                opportunity=item,
            )
        for enquiry in Enquiry.objects.filter(from_email__iexact=email).order_by("-created_at")[:5]:
            linked = Opportunity.objects.filter(enquiry=enquiry).first()
            if linked is not None and exclude is not None and linked.pk == exclude.pk:
                continue
            add(
                "enquiry",
                enquiry.ref,
                enquiry.subject or enquiry.ref,
                f"Same sender email ({email})",
                enquiry.get_absolute_url(),
                opportunity=linked,
                enquiry=enquiry,
            )
    if len(org) >= 4:
        for item in opportunities.exclude(organisation="").only("id", "number", "title", "organisation")[
            :500
        ]:
            if _core_name(item.organisation) == org:
                add(
                    "opportunity",
                    item.ref,
                    item.title,
                    f"Same organisation ({item.organisation})",
                    item.get_absolute_url(),
                    opportunity=item,
                )
    for ref in set(VIT_REF.findall(source_text or "")):
        enquiry = enquiry_selectors.get_by_ref(ref)
        if enquiry is not None:
            linked = Opportunity.objects.filter(enquiry=enquiry).first()
            add(
                "enquiry",
                enquiry.ref,
                enquiry.subject or enquiry.ref,
                f"The text mentions {enquiry.ref}",
                enquiry.get_absolute_url(),
                opportunity=linked,
                enquiry=enquiry,
            )
    return list(found.values())


BRIEF_FORM_FIELDS = tuple(name for name, _ in extraction.FIELDS)


def clean_brief_values(raw: dict) -> dict:
    """Edited preview values -> opportunity detail values (trimmed, validated against choices)."""
    values = {}
    for name in BRIEF_FORM_FIELDS:
        text = str(raw.get(name, "") or "").strip()
        if name == "sector" and text not in Sector.values:
            text = ""
        if name == "budget_band":
            from .models import BudgetBand

            text = text if text in BudgetBand.values else ""
        values[name] = text[:4000] if name in NARRATIVE or name == "current_tools" else text[:200]
    return values


def _fill(opportunity: Opportunity, data: dict, accept: set[str] | None) -> dict:
    """Values to write onto an existing opportunity: the accepted fields, or by default only blank ones."""
    out = {}
    for name, value in data.items():
        if name == "next_action_due":
            continue
        chosen = name in accept if accept is not None else not getattr(opportunity, name, "")
        if chosen:
            out[name] = value
    if "next_action" in out and "next_action_due" in data:
        out["next_action_due"] = data["next_action_due"]
    return out


def apply_brief(
    draft: Draft,
    values: dict,
    actor,
    *,
    target: str = "new",
    title: str = "",
    offer: str = "",
    next_action: str = "",
    accept: set[str] | None = None,
    request=None,
) -> Opportunity:
    """The human decision on a brief: create the opportunity, or update/link an existing one.

    ``target``: ``new``; ``update:<OPP ref>`` (fill blanks of an existing opportunity from the brief);
    ``enquiry:<VIT ref>`` (create the opportunity from that enquiry, then apply the brief). Idempotent: a
    second call on an approved draft returns the opportunity it already made.
    """
    _require(actor)
    values = clean_brief_values(values)
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        if locked.state == DraftState.APPROVED and locked.opportunity_id:
            return locked.opportunity
        if locked.kind != DraftKind.BRIEF or locked.state not in (DraftState.DRAFT, DraftState.REVIEWED):
            raise ValidationError("This brief is not ready to apply.")
        if locked.opportunity_id and target == "new":
            target = f"update:{locked.opportunity.ref}"
        from . import services

        offer = offer if offer in Offer.values else ""
        action = (next_action or "").strip()[:300]
        due = services.next_working_day(timezone.localdate()) if action else None
        data = {k: v for k, v in values.items() if v}
        if offer:
            data["offer"] = offer
        if action:
            data["next_action"], data["next_action_due"] = action, due
        if target.startswith("update:"):
            opportunity = selectors.get_by_ref(target.split(":", 1)[1])
            if opportunity is None:
                raise ValidationError("That opportunity no longer exists.")
            fill = _fill(opportunity, data, accept)
            services.update_details(opportunity, fill, actor, request=request)
            created = False
        elif target.startswith("enquiry:"):
            enquiry = enquiry_selectors.get_by_ref(target.split(":", 1)[1])
            if enquiry is None:
                raise ValidationError("That enquiry no longer exists.")
            opportunity = services.create_from_enquiry(enquiry, offer=offer, actor=actor, request=request)
            fill = _fill(opportunity, data, accept)
            services.update_details(opportunity, fill, actor, request=request)
            created = True
        else:
            if not (
                data.get("organisation")
                or data.get("contact_name")
                or data.get("contact_email")
                or title.strip()
            ):
                raise ValidationError("Give the opportunity a title, an organisation or a contact.")
            title_text = (
                title or data.get("organisation") or data.get("contact_name") or data.get("contact_email", "")
            ).strip()[:200]
            payload = {**data, "title": title_text, "source": OpportunitySource.OTHER}
            payload.pop("budget_band", None) if not data.get("budget_band") else None
            opportunity = services.create_opportunity(payload, actor, request=request)
            created = True
        now = timezone.now()
        locked.opportunity = opportunity
        if opportunity.enquiry_id and locked.enquiry_id is None:
            locked.enquiry = opportunity.enquiry
        locked.payload = {
            **locked.payload,
            "fields": values,
            "applied": {"target": target, "offer": offer, "next_action": action},
        }
        locked.state = DraftState.APPROVED
        locked.reviewed_by = locked.reviewed_by or actor
        locked.reviewed_at = locked.reviewed_at or now
        locked.decided_by, locked.decided_at = actor, now
        try:
            latest = (
                Draft.objects.filter(opportunity=opportunity, kind=DraftKind.BRIEF)
                .exclude(pk=locked.pk)
                .order_by("-version")
                .first()
            )
            locked.version = latest.version + 1 if latest else 1
            locked.save()
        except IntegrityError as exc:
            raise ValidationError("This brief was applied at the same time. Reload.") from exc
        Draft.objects.filter(
            opportunity=opportunity, kind=DraftKind.BRIEF, state=DraftState.APPROVED
        ).exclude(pk=locked.pk).update(state=DraftState.SUPERSEDED)
        record(
            "aidata.brief_approved",
            request=request,
            actor=actor,
            entity=opportunity,
            entity_id=opportunity.ref,
            summary=f"Approved the brief for {opportunity.ref}" + (" and created it" if created else ""),
            draft=locked.pk,
            mode=locked.mode,
            created=created,
            enquiry=opportunity.enquiry.ref if opportunity.enquiry_id else "",
        )
    return opportunity


# --- Discovery questions ---------------------------------------------------------------------------


def _brief_context(opportunity: Opportunity) -> str:
    lines = [
        ("Organisation", opportunity.organisation),
        ("Sector", opportunity.get_sector_display() if opportunity.sector else ""),
        ("Problem", opportunity.problem_summary),
        ("Current process and tools", opportunity.current_tools),
        ("Desired outcome", opportunity.desired_outcome),
        ("Timeframe", opportunity.timeframe),
        ("Budget band", opportunity.get_budget_band_display() if opportunity.budget_band else ""),
    ]
    return "\n".join(f"{label}: {value}" for label, value in lines if value) or "(The brief is empty.)"


def run_questions(draft: Draft) -> Outcome:
    opportunity = draft.opportunity
    base = {"questions": catalog.template_questions(opportunity.offer)}
    if draft.requested_mode != DraftMode.AI:
        return Outcome(base, DraftMode.RULES)
    try:
        tasks.heartbeat(draft)
        run = ai.run_prompt(
            "discovery_questions",
            1,
            data=_brief_context(opportunity),
            run_ref=f"draft-{draft.pk}",
            workflow="aidata.discovery_questions",
            variables={"offer_name": opportunity.get_offer_display() or "not chosen yet"},
        )
    except ai.AiUnavailable as exc:
        return Outcome(base, DraftMode.RULES, fallback_reason=str(exc)[:300] or "AI is unavailable.")
    questions = [
        {
            "id": f"q{index}",
            "question": q["question"].strip(),
            "why": q["why"].strip(),
            "answer": "",
            "status": "open",
        }
        for index, q in enumerate(run.output["questions"], start=1)
        if q["question"].strip()
    ]
    return Outcome(
        {"questions": questions},
        DraftMode.AI,
        ai_payload=run.output,
        prompt_ref=f"{run.prompt_id}@{run.prompt_version}",
        execution_id=run.execution_id,
        simulated=run.simulated,
    )


# --- Discovery pack -------------------------------------------------------------------------------


def run_discovery(draft: Draft) -> Outcome:
    notes = draft.source_text
    base = discovery.from_notes(notes)
    base_evidence = discovery.evidence_for_pack(base)
    if draft.requested_mode != DraftMode.AI:
        return Outcome(base, DraftMode.RULES, evidence=base_evidence)
    try:
        tasks.heartbeat(draft)
        run = ai.run_prompt(
            "discovery_pack", 1, data=notes, run_ref=f"draft-{draft.pk}", workflow="aidata.discovery_pack"
        )
    except ai.AiUnavailable as exc:
        return Outcome(
            base,
            DraftMode.RULES,
            evidence=base_evidence,
            fallback_reason=str(exc)[:300] or "AI is unavailable.",
        )
    pack, warnings = discovery.sanitise_ai_pack(run.output, notes)
    return Outcome(
        pack,
        DraftMode.AI,
        ai_payload=run.output,
        evidence=discovery.evidence_for_pack(pack),
        warnings=warnings,
        prompt_ref=f"{run.prompt_id}@{run.prompt_version}",
        execution_id=run.execution_id,
        simulated=run.simulated,
    )


def start_discovery(
    opportunity: Opportunity, *, notes: str, key: str, actor, mode=DraftMode.AI, request=None
):
    _require(actor)
    text, _ = extraction.clean_source(notes)
    if len(text) < 20:
        raise ValidationError("Paste the meeting notes first (at least a couple of sentences).")
    return tasks.submit(
        DraftKind.DISCOVERY,
        key=key,
        actor=actor,
        opportunity=opportunity,
        source_text=text,
        source_label="Meeting notes",
        requested_mode=mode,
        request=request,
    )


def start_questions(opportunity: Opportunity, *, key: str, actor, mode=DraftMode.AI, request=None):
    _require(actor)
    return tasks.submit(
        DraftKind.QUESTIONS,
        key=key,
        actor=actor,
        opportunity=opportunity,
        requested_mode=mode,
        request=request,
    )


def manual_discovery(opportunity: Opportunity, *, key: str, actor, request=None):
    """An empty pack for a person to fill in by hand (needs no AI and no notes)."""
    _require(actor)
    return _manual(opportunity, key, actor, request)


def _manual(opportunity, key, actor, request):
    draft, created = tasks.submit(
        DraftKind.DISCOVERY,
        key=key,
        actor=actor,
        opportunity=opportunity,
        source_label="Written by hand",
        requested_mode=DraftMode.MANUAL,
        run=False,
        request=request,
    )
    if created:
        Draft.objects.filter(pk=draft.pk, state=DraftState.QUEUED).update(
            state=DraftState.DRAFT,
            mode=DraftMode.MANUAL,
            payload=discovery.empty_pack(),
            finished_at=timezone.now(),
        )
        draft.refresh_from_db()
    return draft, created


# --- Proposal -------------------------------------------------------------------------------------


def approved_discovery(opportunity: Opportunity) -> Draft | None:
    return (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.DISCOVERY, state=DraftState.APPROVED)
        .order_by("-version")
        .first()
    )


def price_block(offer: str) -> dict:
    price = OfferPrice.objects.filter(key=offer).first() if offer in Offer.values else None
    if price is None:
        return {
            "kind": "none",
            "label": "No price yet",
            "amount": "",
            "note": "No offer price is set in AI & Data > Offers.",
        }
    validated = price.status == "validated"
    return {
        "kind": "offer_price",
        "amount": str(price.price),
        "basis": price.basis,
        "label": selectors.price_label(price),
        "status": price.status,
        "note": (
            "Validated list price from AI & Data > Offers."
            if validated
            else "Proposed list price from AI & Data > Offers: a commercial assumption, not validated and not published."
        ),
    }


def build_proposal(opportunity: Opportunity, basis: Draft, price: dict | None = None) -> dict:
    """Assemble the proposal from the approved discovery pack and the offer definition. No model."""
    definition = catalog.definition(opportunity.offer)
    pack = basis.payload
    steps = pack.get("workflow_steps", [])
    subject = opportunity.organisation or opportunity.title
    scope = [item["text"] for item in pack.get("requirements", [])]
    if steps:
        scope.append(
            "Workflow in scope: "
            + "; ".join(
                (s.get("action") or s.get("input") or "").strip()
                for s in steps[:6]
                if (s.get("action") or s.get("input"))
            )
        )
    dependencies = list(definition["customer_inputs"]) if definition else []
    dependencies += [f"Assumption: {item['text']}" for item in pack.get("assumptions", [])]
    dependencies += [f"To be confirmed: {item['text']}" for item in pack.get("unknowns", [])]
    return {
        "title": f"{definition['name'] if definition else 'Proposal'} for {subject}",
        "offer": opportunity.offer,
        "offer_name": definition["name"] if definition else "",
        "summary": pack.get("summary") or opportunity.problem_summary,
        "scope": scope,
        "deliverables": list(definition["deliverables"]) if definition else [],
        "exclusions": list(definition["exclusions"]) if definition else [],
        "dependencies": dependencies,
        "milestones": [
            {"name": n, "description": d, "target": ""}
            for n, d in (definition["milestones"] if definition else [])
        ],
        "acceptance_criteria": [item["text"] for item in pack.get("acceptance_criteria", [])],
        "payment": definition["payment"] if definition else "",
        "exit_criteria": definition["exit_criteria"] if definition else "",
        "price": price if price is not None else price_block(opportunity.offer),
        "notes": list(catalog.PROPOSAL_NOTES),
        "discovery_version": basis.version,
    }


def run_proposal(draft: Draft) -> Outcome:
    opportunity, basis = draft.opportunity, draft.basis
    if basis is None or basis.state != DraftState.APPROVED:
        raise ValidationError("A proposal can only be drafted from an approved discovery pack.")
    if not opportunity.offer:
        raise ValidationError("Choose an offer on the opportunity first.")
    return Outcome(build_proposal(opportunity, basis), DraftMode.RULES)


def start_proposal(opportunity: Opportunity, *, key: str, actor, request=None):
    _require(actor)
    basis = approved_discovery(opportunity)
    if basis is None:
        raise ValidationError(
            "Approve a discovery pack first. A proposal is drafted only from approved discovery."
        )
    if not opportunity.offer:
        raise ValidationError("Choose an offer on the opportunity first.")
    return tasks.submit(
        DraftKind.PROPOSAL,
        key=key,
        actor=actor,
        opportunity=opportunity,
        source_label=f"Approved discovery v{basis.version}",
        requested_mode=DraftMode.RULES,
        basis=basis,
        request=request,
    )


PROPOSAL_LISTS = ("scope", "deliverables", "exclusions", "dependencies", "acceptance_criteria")


def normalise_proposal(data: dict, current: dict) -> dict:
    out = dict(current)
    out["title"] = str(data.get("title", current.get("title", ""))).strip()[:200]
    out["summary"] = str(data.get("summary", current.get("summary", ""))).strip()[:2000]
    for name in PROPOSAL_LISTS:
        if name in data:
            raw = data[name]
            lines = raw.splitlines() if isinstance(raw, str) else list(raw)
            out[name] = [str(line).strip()[:400] for line in lines if str(line).strip()][:40]
    if "milestones" in data:
        out["milestones"] = [
            {
                "name": str(m.get("name", "")).strip()[:200],
                "description": str(m.get("description", "")).strip()[:400],
                "target": str(m.get("target", "")).strip()[:100],
            }
            for m in data["milestones"]
            if str(m.get("name", "")).strip()
        ][:20]
    if "payment" in data:
        out["payment"] = str(data["payment"]).strip()[:400]
    return out


def set_price(payload: dict, *, kind: str, amount: str = "", note: str = "", offer: str = "") -> dict:
    """The proposal's price: the offer's approved price, or an estimate a person typed (clearly labelled)."""
    payload = dict(payload)
    if kind == "offer_price":
        payload["price"] = price_block(offer or payload.get("offer", ""))
    elif kind == "estimate":
        try:
            value = Decimal(str(amount).replace(",", "").replace("£", "").strip())
            if value < 0 or value > Decimal("10000000"):
                raise InvalidOperation
        except InvalidOperation as exc:
            raise ValidationError("Enter the estimate as an amount in pounds.") from exc
        payload["price"] = {
            "kind": "estimate",
            "amount": f"{value:.2f}",
            "label": f"Estimate £{value:,.2f}".replace(".00", ""),
            "note": (
                note or "Estimate by Vitalos. Not a quote and not a price from AI & Data > Offers."
            ).strip()[:300],
        }
    else:
        payload["price"] = {
            "kind": "none",
            "label": "No price yet",
            "amount": "",
            "note": "To be priced before sending.",
        }
    return payload


def proposal_blockers(draft: Draft) -> list[str]:
    payload = draft.payload
    blockers = []
    current = approved_discovery(draft.opportunity)
    if current is None or draft.basis_id != current.pk:
        blockers.append(
            "The approved discovery pack changed after this draft. Draft the proposal again from the current one."
        )
    for name, label in (
        ("scope", "scope"),
        ("deliverables", "deliverables"),
        ("acceptance_criteria", "acceptance criteria"),
    ):
        if not payload.get(name):
            blockers.append(f"Add {label}.")
    if not payload.get("milestones"):
        blockers.append("Add at least one milestone.")
    if (payload.get("price") or {}).get("kind") not in ("offer_price", "estimate"):
        blockers.append("Choose the offer price or enter a labelled estimate.")
    return blockers


# --- Review, approve, reject, revise --------------------------------------------------------------


def _editable(draft: Draft) -> None:
    if draft.is_locked:
        raise ValidationError("An approved or closed draft is history. Revise it to make a new version.")
    if draft.state not in (DraftState.DRAFT, DraftState.REVIEWED):
        raise ValidationError("This draft is not ready to edit.")


def save_payload(draft: Draft, payload: dict, actor, request=None) -> Draft:
    """A person's edit. Editing a reviewed draft sends it back to draft: it needs reviewing again."""
    _require(actor)
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        _editable(locked)
        if locked.kind == DraftKind.DISCOVERY:
            payload = discovery.normalise_pack(payload)
            locked.evidence = discovery.evidence_for_pack(payload)
        locked.payload = payload
        if locked.state == DraftState.REVIEWED:
            locked.state, locked.reviewed_by, locked.reviewed_at = DraftState.DRAFT, None, None
        locked.save()
        _record("aidata.draft_edited", locked, actor, request, "Edited")
    return locked


def _record(action, draft, actor, request, verb, **extra):
    opportunity = draft.opportunity
    record(
        action,
        request=request,
        actor=actor,
        entity=opportunity if opportunity is not None else draft,
        entity_id=opportunity.ref if opportunity is not None else str(draft.pk),
        summary=f"{verb} {draft.get_kind_display().lower()} v{draft.version}"
        + (f" for {opportunity.ref}" if opportunity else ""),
        draft=draft.pk,
        kind=draft.kind,
        version=draft.version,
        mode=draft.mode,
        **extra,
    )


def mark_reviewed(draft: Draft, actor, request=None) -> Draft:
    _require(actor)
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        if locked.state == DraftState.REVIEWED:
            return locked
        if locked.state != DraftState.DRAFT:
            raise ValidationError("Only a draft can be marked reviewed.")
        locked.state, locked.reviewed_by, locked.reviewed_at = DraftState.REVIEWED, actor, timezone.now()
        locked.save()
        _record("aidata.draft_reviewed", locked, actor, request, "Reviewed")
    return locked


def approval_blockers(draft: Draft) -> list[str]:
    if draft.kind == DraftKind.DISCOVERY:
        return discovery.approval_blockers(draft.payload)
    if draft.kind == DraftKind.PROPOSAL:
        return proposal_blockers(draft)
    return []


def approve(draft: Draft, actor, note: str = "", request=None) -> Draft:
    """Approve a reviewed draft. Nothing is sent or published; a proposal is only marked ready."""
    _require(actor)
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        if locked.state == DraftState.APPROVED:
            return locked
        if locked.kind not in (DraftKind.DISCOVERY, DraftKind.PROPOSAL, DraftKind.QUESTIONS):
            raise ValidationError("A brief is approved when the opportunity is created.")
        if locked.state != DraftState.REVIEWED:
            raise ValidationError("Review it first: check it against the source, then mark it reviewed.")
        blockers = approval_blockers(locked)
        if blockers:
            raise ValidationError(blockers)
        now = timezone.now()
        locked.state, locked.decided_by, locked.decided_at, locked.decision_note = (
            DraftState.APPROVED,
            actor,
            now,
            note[:500],
        )
        locked.save()
        if locked.opportunity_id:
            Draft.objects.filter(
                opportunity=locked.opportunity, kind=locked.kind, state=DraftState.APPROVED
            ).exclude(pk=locked.pk).update(state=DraftState.SUPERSEDED)
        _record("aidata.draft_approved", locked, actor, request, "Approved")
    return locked


def reject(draft: Draft, actor, note: str = "", request=None) -> Draft:
    _require(actor)
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        if locked.state == DraftState.REJECTED:
            return locked
        if locked.state not in (DraftState.DRAFT, DraftState.REVIEWED, DraftState.FAILED):
            raise ValidationError("Only an unapproved draft can be rejected.")
        locked.state, locked.decided_by, locked.decided_at, locked.decision_note = (
            DraftState.REJECTED,
            actor,
            timezone.now(),
            note[:500],
        )
        locked.save()
        _record("aidata.draft_rejected", locked, actor, request, "Rejected")
    return locked


def revise(draft: Draft, actor, key: str, request=None) -> Draft:
    """Start a new editable version of an approved draft; the approved one stays as it was."""
    _require(actor)
    if draft.state != DraftState.APPROVED or draft.opportunity_id is None:
        raise ValidationError("Only an approved draft can be revised.")
    existing = Draft.objects.filter(idempotency_key=key[:64]).first() if key else None
    if existing is not None:
        return existing
    open_version = Draft.objects.filter(
        opportunity=draft.opportunity, kind=draft.kind, state__in=(DraftState.DRAFT, DraftState.REVIEWED)
    ).first()
    if open_version is not None:
        return open_version
    with transaction.atomic():
        top = (
            Draft.objects.filter(opportunity=draft.opportunity, kind=draft.kind)
            .order_by("-version")
            .first()
            .version
        )
        new = Draft.objects.create(
            opportunity=draft.opportunity,
            enquiry=draft.enquiry,
            kind=draft.kind,
            state=DraftState.DRAFT,
            version=top + 1,
            mode=draft.mode,
            requested_mode=DraftMode.MANUAL,
            idempotency_key=(key or None) and key[:64],
            source_label=draft.source_label,
            source_text=draft.source_text,
            source_hash=draft.source_hash,
            payload=draft.payload,
            ai_payload=draft.ai_payload,
            evidence=draft.evidence,
            basis=draft.basis,
            simulated=draft.simulated,
            prompt_ref=draft.prompt_ref,
            created_by=actor,
            finished_at=timezone.now(),
        )
        _record("aidata.draft_revised", new, actor, request, "Started a revision of")
    return new


def update_questions(draft: Draft, answers: dict[str, str], actor, request=None) -> Draft:
    """Record answers to discovery questions as they come in (questions stay editable until approved)."""
    _require(actor)
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        if locked.is_locked or locked.state not in (DraftState.DRAFT, DraftState.REVIEWED):
            raise ValidationError("This list is closed.")
        questions = locked.payload.get("questions", [])
        for question in questions:
            if question["id"] in answers:
                answer = str(answers[question["id"]]).strip()[:2000]
                question["answer"] = answer
                question["status"] = "answered" if answer else "open"
        locked.payload = {"questions": questions}
        locked.save()
        _record("aidata.draft_edited", locked, actor, request, "Updated answers in")
    return locked


# --- Stage requirements (used by services.change_stage and the UI) ----------------------------------


def stage_blockers(opportunity: Opportunity, to_stage: str) -> list[str]:
    """What must exist before ``opportunity`` can move to ``to_stage``. Empty means nothing blocks it."""
    if to_stage == Stage.PROPOSAL and approved_discovery(opportunity) is None:
        return ["Approve a discovery pack first. A proposal needs approved discovery."]
    return []


def brief_of(opportunity: Opportunity) -> Draft | None:
    return (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.BRIEF)
        .exclude(state__in=(DraftState.REJECTED, DraftState.SUPERSEDED))
        .order_by("-version")
        .first()
    )


RUNNERS = {
    DraftKind.BRIEF: run_brief,
    DraftKind.QUESTIONS: run_questions,
    DraftKind.DISCOVERY: run_discovery,
    DraftKind.PROPOSAL: run_proposal,
}

__all__ = ["Outcome", "RUNNERS"]
