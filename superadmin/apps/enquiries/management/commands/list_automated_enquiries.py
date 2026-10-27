"""List existing enquiries that the automated-mail rules (ADR-046) would file differently. Read-only.

Nothing is changed: the list is for a person to tidy by hand (move to Automated, or correct the sender
of a form relay). Prints references, current status and the reason, never addresses or message text.
"""

from django.core.management.base import BaseCommand

from apps.enquiries import automated
from apps.enquiries.models import Enquiry, InboxSettings, Message


class Command(BaseCommand):
    help = "List enquiries the automated-mail rules would class as automated or as a form relay. Read-only."

    def handle(self, *args, **options):
        senders = InboxSettings.load().automated_sender_list()
        rows = []
        for enquiry in Enquiry.objects.exclude(status=Enquiry.Status.AUTOMATED).order_by("number"):
            first = (
                enquiry.messages.filter(direction=Message.Direction.INBOUND)
                .order_by("created_at", "id")
                .first()
            )
            if first is None:
                continue
            result = automated.classify(
                from_email=first.from_email,
                headers=first.headers_json or {},
                is_auto=first.is_auto,
                senders=senders,
            )
            if result.kind == automated.PERSON and automated.is_own_address(first.from_email):
                rows.append((enquiry, "check", "From a Vitalos address: likely a Vitalos system email"))
            elif result.kind in (automated.AUTOMATED, automated.OWN):
                rows.append((enquiry, "automated", result.reason))
            elif result.kind == automated.FORM and enquiry.from_email != result.person_email:
                rows.append(
                    (enquiry, "form relay", f"{result.reason}: the sender should be the Reply-To person")
                )
        already = Enquiry.objects.filter(status=Enquiry.Status.AUTOMATED).count()
        self.stdout.write(f"Already filed under Automated: {already}")
        self.stdout.write(f"Would be filed differently now: {len(rows)} (nothing has been changed)")
        for enquiry, kind, reason in rows:
            self.stdout.write(f"  {enquiry.ref}  [{Enquiry.Status(enquiry.status).label}]  {kind}: {reason}")
