"""Which inbound mail is an enquiry, and which is machine mail (ADR-046).

The support mailbox receives the platform's own notifications, product notifications (Askbridge),
booking tools (cal.com) and auto-replies. Each used to become an enquiry and trigger another alert.

- **Form relays** (``X-Vitalos-Form``, and the website's enquiry notification): a person's message that
  a Vitalos system forwarded. Filed as an enquiry from the person in ``Reply-To``, never from the
  forwarding address. A website notification for a reference already filed is linked to that enquiry.
- **Own notifications** (``X-Vitalos-Notification`` from a vitalos.co.uk address): linked to the enquiry
  named by ``X-Vitalos-Reference`` when there is one; otherwise automated.
- **Automated**: ``Auto-Submitted`` other than ``no`` (and the other RFC 3834 signs), a no-reply or
  mailer-daemon address, or a sender on the Inbox settings list. Filed under Automated: stored and
  searchable, no alert, no response target.

Only the address decides "no-reply", never the display name: "No Reply Bob <bob@example.com>" is a person.
Nothing is deleted or dropped.
"""

from __future__ import annotations

import email.utils
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.core.validators import validate_email

PERSON = "person"
FORM = "form"
OWN = "own"
AUTOMATED = "automated"

NOTIFICATION_HEADER = "X-Vitalos-Notification"
REFERENCE_HEADER = "X-Vitalos-Reference"
FORM_HEADER = "X-Vitalos-Form"
#: AI & Data form relays (docs/ai-data/PLAN.md): the ingest opens an opportunity from them.
PIPELINE_HEADER = "X-Vitalos-Pipeline"
OFFER_HEADER = "X-Vitalos-Offer"
WEB_NOTIFICATION = "web.enquiry-notification"
OWN_DOMAIN = "vitalos.co.uk"
NOREPLY_LOCAL_PARTS = ("mailer-daemon", "postmaster", "noreply", "no-reply", "donotreply", "do-not-reply")


@dataclass(frozen=True)
class Classification:
    kind: str
    reason: str
    #: For form relays: the person in Reply-To.
    person_name: str = ""
    person_email: str = ""
    #: The reference an own notification or website notification names.
    reference: str = ""


def is_own_address(address: str) -> bool:
    domain = (address or "").rsplit("@", 1)[-1].strip().lower()
    return domain == OWN_DOMAIN or domain.endswith(f".{OWN_DOMAIN}")


def is_noreply_address(address: str) -> bool:
    local = (address or "").split("@")[0].strip().lower()
    return local.startswith(NOREPLY_LOCAL_PARTS)


def on_sender_list(address: str, senders: list[str]) -> bool:
    address = (address or "").strip().lower()
    domain = "@" + address.rsplit("@", 1)[-1]
    return any(entry == address or (entry.startswith("@") and entry == domain) for entry in senders)


def _reply_to(headers: dict[str, str]) -> tuple[str, str]:
    """The single person in Reply-To, if it is a valid address that is not ours."""
    people = [(name, addr.lower()) for name, addr in email.utils.getaddresses([headers.get("Reply-To", "")])]
    if len(people) != 1:
        return "", ""
    name, address = people[0]
    try:
        validate_email(address)
    except ValidationError:
        return "", ""
    if is_own_address(address) or is_noreply_address(address):
        return "", ""
    return name.strip()[:200], address


def classify(
    *, from_email: str, headers: dict[str, str], is_auto: bool, senders: list[str]
) -> Classification:
    """Decide what a new inbound message is. ``headers`` are the kept headers (``ingest.KEPT_HEADERS``)."""
    notification = (headers.get(NOTIFICATION_HEADER) or "").strip()
    reference = (headers.get(REFERENCE_HEADER) or "").strip()[:100]
    own = is_own_address(from_email)
    if own and (headers.get(FORM_HEADER) or notification == WEB_NOTIFICATION):
        name, address = _reply_to(headers)
        if address:
            via = headers.get(FORM_HEADER) or notification
            return Classification(FORM, f"Form relay ({via})", name, address, reference)
    if own and notification:
        return Classification(OWN, f"Vitalos notification ({notification})", reference=reference)
    if is_auto:
        return Classification(AUTOMATED, "Automated mail (Auto-Submitted, bounce or list headers)")
    if is_noreply_address(from_email):
        return Classification(AUTOMATED, "No-reply sender address")
    if on_sender_list(from_email, senders):
        return Classification(AUTOMATED, "Booking or notification sender (Inbox settings)")
    return Classification(PERSON, "Person")
