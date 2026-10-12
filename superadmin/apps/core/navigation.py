"""Primary navigation: one definition shared by the sidebar, breadcrumbs and the command palette.

An item either links to a page or, with ``children``, is a dropdown (Mail). Each child has its own
permission; a dropdown is shown when at least one child is visible. Hiding an item is only a
convenience: every view enforces its own role on the server.
"""

from collections.abc import Iterator
from dataclasses import dataclass

from django.urls import NoReverseMatch, reverse
from django.utils.module_loading import import_string


@dataclass(frozen=True)
class NavItem:
    key: str
    label: str
    url_name: str
    icon: str
    group: str
    prefixes: tuple[str, ...]
    exact: bool = False
    # Dotted path to ``fn(user) -> bool`` when only some roles may see the item.
    permission: str = ""
    children: tuple["NavItem", ...] = ()

    @property
    def url(self) -> str:
        return reverse(self.url_name)

    def matches(self, path: str) -> bool:
        if self.children:
            return any(child.matches(path) for child in self.children)
        if self.exact:
            return path == self.url
        return any(path.startswith(prefix) for prefix in self.prefixes)


GROUPS = ("Operate", "Organisation", "System")

NAV_ITEMS = (
    NavItem("overview", "Overview", "architecture:home", "layout-dashboard", "Operate", ("/",), exact=True),
    NavItem(
        "mail",
        "Mail",
        "",
        "mail",
        "Operate",
        (),
        children=(
            NavItem(
                "enquiries",
                "Enquiries",
                "enquiries:inbox",
                "inbox",
                "Operate",
                ("/enquiries",),
                permission="apps.enquiries.selectors.can_access",
            ),
            NavItem(
                "email_templates",
                "Email templates",
                "email_templates:list",
                "pen",
                "Operate",
                ("/mail/templates",),
                permission="apps.accounts.roles.is_superadmin",
            ),
        ),
    ),
    NavItem("activity", "Activity", "architecture:activity", "activity", "Operate", ("/activity", "/audit")),
    NavItem(
        "service_lines",
        "Service lines",
        "architecture:service_lines",
        "layers",
        "Organisation",
        ("/service-lines", "/s/"),
    ),
    NavItem("team", "Team", "architecture:team", "users", "Organisation", ("/team",)),
    NavItem(
        "architecture", "Architecture", "architecture:architecture", "network", "System", ("/architecture",)
    ),
    NavItem("settings", "Settings", "accounts:settings", "settings", "System", ("/settings",)),
)


def leaf_items() -> Iterator[NavItem]:
    """Every page link, with dropdown children in place of their parent."""
    for item in NAV_ITEMS:
        if item.children:
            yield from item.children
        else:
            yield item


def is_available(item: NavItem) -> bool:
    if item.children:
        return any(is_available(child) for child in item.children)
    try:
        reverse(item.url_name)
    except NoReverseMatch:
        return False
    return True


def is_visible(item: NavItem, user) -> bool:
    if item.permission and not import_string(item.permission)(user):
        return False
    if item.children:
        return any(is_visible(child, user) for child in item.children)
    return is_available(item)


def _entry(item: NavItem, path: str) -> dict:
    return {"item": item, "url": item.url, "active": item.matches(path)}


def nav_groups(path: str, user=None) -> list[dict]:
    """Sidebar groups with each item's URL and active state for ``path``."""
    groups = []
    for group in GROUPS:
        items = []
        for item in NAV_ITEMS:
            if item.group != group or not is_visible(item, user):
                continue
            if item.children:
                children = [_entry(child, path) for child in item.children if is_visible(child, user)]
                items.append(
                    {"item": item, "children": children, "active": any(c["active"] for c in children)}
                )
            else:
                items.append(_entry(item, path))
        if items:
            groups.append({"label": group, "items": items})
    return groups


def crumb_label(item: NavItem | None) -> str:
    """The breadcrumb before an item: its dropdown (Mail) for a child, otherwise its group."""
    if item is None:
        return ""
    parent = next((p for p in NAV_ITEMS if item in p.children), None)
    return parent.label if parent else item.group


def active_item(path: str) -> NavItem | None:
    return next((item for item in leaf_items() if is_available(item) and item.matches(path)), None)
