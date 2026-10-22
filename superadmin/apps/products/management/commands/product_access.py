"""Grant, revoke or show Product Pipeline permissions for one user. Every change is audited.

    python manage.py product_access --email person@vitalos.co.uk
    python manage.py product_access --email person@vitalos.co.uk --grant view_product_pipeline
    python manage.py product_access --email person@vitalos.co.uk --grant open_askbridge_superadmin
    python manage.py product_access --email person@vitalos.co.uk --revoke open_askbridge_superadmin

SuperAdmins (and Django superusers) hold every permission already. Everyone else also needs a role
(Settings → Users). Granting a product permission also grants ``view_product_pipeline``, which it needs.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.roles import has_any_role, is_superadmin
from apps.audit.services import record
from apps.products.access import VIEW_PERMISSION
from apps.products.models import ProductAccess

VIEW_CODENAME = VIEW_PERMISSION.split(".", 1)[1]
CODENAMES = tuple(codename for codename, _label in ProductAccess._meta.permissions)


def _permission(codename: str) -> Permission:
    if codename not in CODENAMES:
        raise CommandError(f"Unknown permission {codename!r}. Choose from: {', '.join(CODENAMES)}.")
    try:
        return Permission.objects.get(content_type__app_label="products", codename=codename)
    except Permission.DoesNotExist:
        raise CommandError("Permissions are missing: run `python manage.py migrate` first.") from None


class Command(BaseCommand):
    help = "Grant, revoke or show a user's Product Pipeline permissions (audited)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email address.")
        action = parser.add_mutually_exclusive_group()
        action.add_argument("--grant", metavar="CODENAME", choices=CODENAMES)
        action.add_argument("--revoke", metavar="CODENAME", choices=CODENAMES)

    def handle(self, *args, email, grant=None, revoke=None, **options):
        user = get_user_model().objects.filter(email__iexact=email.strip()).first()
        if user is None:
            raise CommandError(f"No user with the email {email!r}.")
        if grant:
            granted = [_permission(grant)]
            if grant != VIEW_CODENAME:
                granted.insert(0, _permission(VIEW_CODENAME))
            for permission in granted:
                if not user.user_permissions.filter(pk=permission.pk).exists():
                    user.user_permissions.add(permission)
                    record(
                        "products.access_granted",
                        entity=user,
                        summary=f"{user.email}: products.{permission.codename} (manage.py)",
                        permission=f"products.{permission.codename}",
                    )
            self.stdout.write(f"Granted products.{grant} to {user.email}.")
        elif revoke:
            permission = _permission(revoke)
            if user.user_permissions.filter(pk=permission.pk).exists():
                user.user_permissions.remove(permission)
                record(
                    "products.access_revoked",
                    entity=user,
                    summary=f"{user.email}: products.{permission.codename} (manage.py)",
                    permission=f"products.{permission.codename}",
                )
            self.stdout.write(f"Revoked products.{revoke} from {user.email}.")
        held = sorted(
            user.user_permissions.filter(content_type__app_label="products").values_list(
                "codename", flat=True
            )
        )
        self.stdout.write(f"{user.email} holds: {', '.join(held) or 'no Product Pipeline permissions'}.")
        if is_superadmin(user):
            self.stdout.write("This user is a SuperAdmin and already has every Product Pipeline permission.")
        elif not has_any_role(user):
            self.stdout.write(
                self.style.WARNING(
                    "This user has no role, so the permissions have no effect until one is given."
                )
            )
