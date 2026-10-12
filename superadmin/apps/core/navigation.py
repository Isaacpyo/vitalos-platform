"""Primary navigation: one definition shared by the sidebar, breadcrumbs and the command palette."""

from dataclasses import dataclass

from django.urls import NoReverseMatch, reverse


@dataclass(frozen=True)
class NavItem:
    key: str
    label: str
    url_name: str
    icon: str
    group: str
    prefixes: tuple[str, ...]
    exact: bool = False

    @property
    def url(self) -> str:
        return reverse(self.url_name)

    def matches(self, path: str) -> bool:
        if self.exact:
            return path == self.url
        return any(path.startswith(prefix) for prefix in self.prefixes)


GROUPS = ("Operate", "Organisation", "System")

NAV_ITEMS = (
    NavItem("overview", "Overview", "architecture:home", "layout-dashboard", "Operate", ("/",), exact=True),
    NavItem("enquiries", "Enquiries", "enquiries:inbox", "inbox", "Operate", ("/enquiries",)),
    NavItem("activity", "Activity", "architecture:activity", "activity", "Operate", ("/activity",)),
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


def is_available(item: NavItem) -> bool:
    try:
        reverse(item.url_name)
    except NoReverseMatch:
        return False
    return True


def nav_groups(path: str) -> list[dict]:
    """Sidebar groups with each item's URL and active state for ``path``."""
    groups = []
    for group in GROUPS:
        items = [
            {"item": item, "url": item.url, "active": item.matches(path)}
            for item in NAV_ITEMS
            if item.group == group and is_available(item)
        ]
        if items:
            groups.append({"label": group, "items": items})
    return groups


def active_item(path: str) -> NavItem | None:
    return next((item for item in NAV_ITEMS if is_available(item) and item.matches(path)), None)
