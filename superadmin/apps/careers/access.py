"""Who may do what in Careers (brief section 9). The Careers admin screens arrive in Phase 4; these
predicates are the only way they decide access.

SuperAdmin holds everything (``apps.accounts.roles``); anyone else needs the Django permission.
Applications hold personal data, so reading them needs ``careers.view_application`` explicitly (a plain
Viewer cannot), and CVs need ``careers.view_cv`` on top.
"""

from apps.accounts.roles import has_any_role, is_superadmin


def _perm(user, codename: str) -> bool:
    return bool(user and user.is_authenticated) and (is_superadmin(user) or user.has_perm(codename))


def can_view_roles(user) -> bool:
    return has_any_role(user)


def can_edit_roles(user) -> bool:
    return has_any_role(user) and _perm(user, "careers.change_role")


def can_publish_roles(user) -> bool:
    return has_any_role(user) and _perm(user, "careers.publish_role")


def can_view_applications(user) -> bool:
    return has_any_role(user) and _perm(user, "careers.view_application")


def can_view_cv(user) -> bool:
    return can_view_applications(user) and _perm(user, "careers.view_cv")


def can_delete_applications(user) -> bool:
    return can_view_applications(user) and _perm(user, "careers.delete_application")


def can_edit_settings(user) -> bool:
    return has_any_role(user) and _perm(user, "careers.change_careerssettings")
