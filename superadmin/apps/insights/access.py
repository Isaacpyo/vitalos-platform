"""Who may do what in Insights. Every view calls these; hiding a button is only a convenience.

SuperAdmin holds everything (through ``apps.accounts.roles``). Anyone else needs the Django
permission: ``insights.change_post`` to edit, ``insights.publish_post`` to approve, publish, schedule
and unpublish. Every signed-in role (Viewer included) may read the lists and the editor.
"""

from apps.accounts.roles import has_any_role, is_superadmin


def _perm(user, codename: str) -> bool:
    return bool(user and user.is_authenticated) and (is_superadmin(user) or user.has_perm(codename))


def can_view(user) -> bool:
    return has_any_role(user)


def can_edit(user) -> bool:
    return can_view(user) and _perm(user, "insights.change_post")


def can_publish(user) -> bool:
    return can_view(user) and _perm(user, "insights.publish_post")


def can_edit_authors(user) -> bool:
    return can_view(user) and _perm(user, "insights.change_author")


def can_confirm_authors(user) -> bool:
    """Recording that an author is a real person who approved their profile gates publishing."""
    return can_view(user) and _perm(user, "insights.publish_post")


def can_edit_topics(user) -> bool:
    return can_view(user) and _perm(user, "insights.change_topic")


def can_edit_settings(user) -> bool:
    return can_view(user) and _perm(user, "content_sync.change_sitesection")


def can_manage_site(user) -> bool:
    """Opening or closing Insights and Careers on the website: SuperAdmin only."""
    return is_superadmin(user)
