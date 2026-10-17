from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.otp import confirmed_devices
from apps.accounts.services import ensure_primary_owner, primary_owner


class Command(BaseCommand):
    help = (
        "Move the primary-owner flag to an existing, active user who has two-factor sign-in (F7). "
        "A dry run unless --apply. The previous owner keeps their account and SuperAdmin role; "
        "disabling or converting it is a separate, owner-approved step (see PRIMARY-OWNER.md)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--to", required=True, help="Email of the user who becomes the primary owner.")
        parser.add_argument("--apply", action="store_true", help="Make the change (default: dry run).")

    def handle(self, *args, to: str, apply: bool, **options):
        from django.contrib.auth import get_user_model

        target = get_user_model().objects.filter(email__iexact=(to or "").strip()).first()
        if target is None:
            raise CommandError(f"No user with the email {to}. This command never creates accounts.")
        if not target.is_active:
            raise CommandError(f"{target.email} is deactivated; reactivate it first.")
        if not confirmed_devices(target).exists():
            raise CommandError(
                f"{target.email} has no confirmed authenticator. The primary owner must use two-factor "
                "sign-in: enrol one first."
            )
        current = primary_owner()
        if current is not None and current.pk == target.pk:
            self.stdout.write(f"{target.email} is already the primary owner; nothing to do.")
            return
        previous = current.email if current else "nobody"
        self.stdout.write(f"Primary owner now: {previous}")
        self.stdout.write(f"Primary owner after: {target.email} ({target.display_label})")
        self.stdout.write(f"{previous} keeps its account, password, authenticator and SuperAdmin role.")
        if not apply:
            self.stdout.write("Dry run: nothing was changed. Re-run with --apply to transfer.")
            return
        try:
            ensure_primary_owner(target.email, transfer=True)  # audited as users.owner_set
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc
        self.stdout.write(self.style.SUCCESS(f"{target.email} is now the primary owner."))
