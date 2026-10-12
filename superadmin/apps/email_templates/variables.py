"""Merge variables: the ``{{name}}`` placeholders a template may use, with descriptions and fallbacks.

A fallback is used whenever a value is missing, in previews and in sends, so an email never shows a
raw placeholder. Unknown names are reported by ``validate`` and left as written.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Variable:
    name: str
    group: str
    description: str
    fallback: str


def _v(group: str, name: str, description: str, fallback: str) -> Variable:
    return Variable(name, group, description, fallback)


VARIABLES: dict[str, Variable] = {
    v.name: v
    for v in (
        _v("Contact", "first_name", "Recipient's first name", "there"),
        _v("Contact", "last_name", "Recipient's last name", ""),
        _v("Contact", "full_name", "Recipient's full name", "there"),
        _v("Contact", "organisation", "Recipient's organisation", "your organisation"),
        _v("Contact", "email", "Recipient's email address", "name@example.com"),
        _v("Contact", "role", "Recipient's role", "your role"),
        _v("Enquiry", "reference", "Enquiry reference", "VIT-0000"),
        _v("Enquiry", "service", "Service or practice", "our services"),
        _v("Enquiry", "intent", "What the enquiry is about", "your enquiry"),
        _v("Enquiry", "timeframe", "Timeframe given in the enquiry", "your timeframe"),
        _v("Enquiry", "goal", "The enquirer's own words", "What you shared with us."),
        _v("Enquiry", "budget_range", "Budget range given in the enquiry", "Not provided"),
        _v("Enquiry", "offer", "Offer the enquiry is about", "our offers"),
        _v("Enquiry", "source_page", "Page the enquiry was sent from", "https://vitalos.co.uk/contact"),
        _v("Enquiry", "received_at", "When the enquiry arrived", "recently"),
        _v("Sender", "sender_name", "Your name", "The Vitalos team"),
        _v("Sender", "sender_title", "Your job title", ""),
        _v("Sender", "sender_email", "Your email address", "support@vitalos.co.uk"),
        _v("Meetings", "meeting_link", "Link to join or book a meeting", "https://vitalos.co.uk/contact"),
        _v("Meetings", "meeting_time", "Meeting date and time", "the agreed time"),
        _v("Meetings", "previous_meeting_time", "The original meeting time", "the original time"),
        _v("Meetings", "reschedule_link", "Link to choose another time", "https://vitalos.co.uk/contact"),
        _v(
            "Sales and delivery",
            "proposal_link",
            "Secure link to the proposal",
            "https://vitalos.co.uk/contact",
        ),
        _v(
            "Sales and delivery",
            "document_link",
            "Secure link to a document",
            "https://vitalos.co.uk/contact",
        ),
        _v("Sales and delivery", "action_link", "Link for the main action", "https://vitalos.co.uk/contact"),
        _v("Sales and delivery", "link_expiry", "When the link expires", "in 7 days"),
        _v("Sales and delivery", "project_name", "Project name", "your project"),
        _v("Sales and delivery", "milestone_name", "Milestone name", "this milestone"),
        _v("Sales and delivery", "status_summary", "Status summary", "Summary to follow."),
        _v("Sales and delivery", "next_steps", "Agreed next steps", "Next steps to follow."),
        _v("Sales and delivery", "change_reference", "Change request reference", "CR-000"),
        _v("Sales and delivery", "case_study_title", "Case study title", "a recent project"),
        _v("Sales and delivery", "case_study_link", "Link to the case study", "https://vitalos.co.uk"),
        _v("Finance", "invoice_number", "Invoice number", "INV-0000"),
        _v("Finance", "quote_number", "Quote number", "Q-0000"),
        _v("Finance", "amount", "Amount, with currency", "£0.00"),
        _v("Finance", "due_date", "Due date", "the due date"),
        _v("Finance", "days_overdue", "Days overdue", "a few"),
        _v("Finance", "renewal_date", "Renewal date", "the renewal date"),
        _v("Events", "event_name", "Event name", "our event"),
        _v("Events", "event_date", "Event date and time", "the event date"),
        _v("Events", "event_link", "Link to the event", "https://vitalos.co.uk"),
        _v("Internal", "assignee_name", "Person the task is for", "there"),
        _v("Internal", "task_name", "Task name", "a task"),
        _v("Internal", "task_due", "When the task is due", "soon"),
        _v("Internal", "admin_link", "Link into the Super Admin", "https://admin.vitalos.co.uk"),
        _v("Marketing", "unsubscribe_link", "Unsubscribe link (added to the footer for you)", ""),
    )
}

PATTERN = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def groups() -> list[tuple[str, list[Variable]]]:
    seen: dict[str, list[Variable]] = {}
    for variable in VARIABLES.values():
        seen.setdefault(variable.group, []).append(variable)
    return list(seen.items())


def names_in(value) -> list[str]:
    """Variable names used anywhere in a string, list or dict, in order of first use."""
    found: list[str] = []

    def walk(item):
        if isinstance(item, str):
            for name in PATTERN.findall(item):
                if name not in found:
                    found.append(name)
        elif isinstance(item, dict):
            for child in item.values():
                walk(child)
        elif isinstance(item, list | tuple):
            for child in item:
                walk(child)

    walk(value)
    return found


def merge(text: str, values: dict[str, str]) -> str:
    """Replaces known variables with their value or fallback; unknown names stay as written."""

    def replace(match):
        name = match.group(1)
        if name not in VARIABLES:
            return match.group(0)
        value = values.get(name)
        return value if value else VARIABLES[name].fallback

    return PATTERN.sub(replace, text or "")


@dataclass
class Validation:
    used: list[str] = field(default_factory=list)
    unknown: list[str] = field(default_factory=list)
    #: Known variables with no value in the sample: the fallback is shown instead.
    fallbacks: list[tuple[str, str]] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.unknown


def validate(content, values: dict[str, str]) -> Validation:
    result = Validation(used=names_in(content))
    for name in result.used:
        if name not in VARIABLES:
            result.unknown.append(name)
        elif not values.get(name):
            result.fallbacks.append((name, VARIABLES[name].fallback))
    return result
