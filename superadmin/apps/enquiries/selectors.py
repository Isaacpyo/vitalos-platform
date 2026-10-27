"""Read rules for enquiries: who may see them, inbox filters, counts and search."""

from django.contrib.auth import get_user_model
from django.db.models import Count, Q

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, has_role

from .models import Enquiry

OPEN_STATUSES = (Enquiry.Status.NEW, Enquiry.Status.OPEN, Enquiry.Status.PENDING)
#: Kept out of "All" and the open counts: spam, and machine mail (ADR-046).
SET_ASIDE = (Enquiry.Status.SPAM, Enquiry.Status.AUTOMATED)

# Filter key -> (label, queryset filter). "mine" is resolved per user.
FILTERS = {
    "all": ("All", ~Q(status__in=SET_ASIDE)),
    "unassigned": ("Unassigned", Q(assignee__isnull=True, status__in=OPEN_STATUSES)),
    "mine": ("Mine", Q(status__in=OPEN_STATUSES)),
    "open": ("New and open", Q(status__in=(Enquiry.Status.NEW, Enquiry.Status.OPEN))),
    "pending": ("Pending", Q(status=Enquiry.Status.PENDING)),
    "resolved": ("Resolved", Q(status=Enquiry.Status.RESOLVED)),
    "automated": ("Automated", Q(status=Enquiry.Status.AUTOMATED)),
    "spam": ("Spam", Q(status=Enquiry.Status.SPAM)),
}
MAX_QUERY = 100


def can_access(user) -> bool:
    """Enquiries hold personal data: SuperAdmin and ServiceLead only (not Viewer)."""
    return has_role(user, SUPERADMIN, SERVICE_LEAD)


def _filter_q(key: str, user) -> Q:
    label, condition = FILTERS.get(key, FILTERS["all"])
    if key == "mine":
        condition &= Q(assignee=user)
    return condition


def inbox(user, filter_key: str = "all", query: str = "", tag: str = ""):
    queryset = Enquiry.objects.filter(_filter_q(filter_key, user))
    query = (query or "").strip()[:MAX_QUERY]
    if query:
        reference = query.upper().removeprefix("VIT-")
        condition = (
            Q(subject__icontains=query)
            | Q(from_email__icontains=query)
            | Q(from_name__icontains=query)
            | Q(messages__text_body__icontains=query)
        )
        if reference.isdigit():
            condition |= Q(number=int(reference))
        queryset = queryset.filter(condition).distinct()
    if tag:
        queryset = queryset.filter(tags__name=tag)
    return queryset.select_related("assignee").prefetch_related("tags")


def filter_counts(user) -> dict[str, int]:
    aggregates = {key: Count("id", filter=_filter_q(key, user)) for key in FILTERS}
    return Enquiry.objects.aggregate(**aggregates)


def unread_badge_count() -> int:
    """Sidebar badge: unread, excluding spam and resolved."""
    return Enquiry.objects.filter(unread=True, status__in=OPEN_STATUSES).count()


def previous_enquiries(enquiry, limit: int = 5):
    return (
        Enquiry.objects.filter(from_email__iexact=enquiry.from_email)
        .exclude(pk=enquiry.pk)
        .order_by("-created_at")[:limit]
    )


def assignable_users():
    """Active users who may work enquiries (SuperAdmin and ServiceLead)."""
    User = get_user_model()
    return (
        User.objects.filter(is_active=True)
        .filter(Q(is_superuser=True) | Q(groups__name__in=(SUPERADMIN, SERVICE_LEAD)))
        .distinct()
        .order_by("email")
    )


def get_by_ref(ref: str):
    number = (ref or "").upper().removeprefix("VIT-")
    if not number.isdigit():
        return None
    return Enquiry.objects.select_related("assignee").filter(number=int(number)).first()


def palette_provider(user, query: str):
    """Enquiries by subject, sender or reference for the command palette."""
    from apps.core.palette import PaletteResult

    if not can_access(user):
        return []
    results = inbox(user, "all", query)[:5] if query else []
    return [
        PaletteResult(
            "Enquiries",
            f"{enquiry.ref} · {enquiry.subject or '(no subject)'}",
            enquiry.get_absolute_url(),
            enquiry.from_email,
            "inbox",
        )
        for enquiry in results
    ]
