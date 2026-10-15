"""Reads for the Insights admin: post list tabs, search and filters."""

from django.db.models import Count, Q

from .models import Author, Post, PostFormat, PostStatus, Topic

MAX_QUERY = 100
TABS = {
    "all": ("All", None),
    "drafts": ("Drafts", (PostStatus.DRAFT,)),
    "review": ("In review", (PostStatus.IN_REVIEW, PostStatus.APPROVED)),
    "scheduled": ("Scheduled", (PostStatus.SCHEDULED,)),
    "published": ("Published", (PostStatus.PUBLISHED,)),
    "archived": ("Archived", (PostStatus.ARCHIVED,)),
}


def tab_counts() -> dict[str, int]:
    by_status = dict(Post.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
    counts = {"all": sum(by_status.values())}
    for key, (_, statuses) in TABS.items():
        if statuses:
            counts[key] = sum(by_status.get(status, 0) for status in statuses)
    return counts


def posts(
    *, tab: str = "all", query: str = "", format_key: str = "", author_id: str = "", topic_id: str = ""
):
    rows = Post.objects.all()
    statuses = TABS.get(tab, TABS["all"])[1]
    if statuses:
        rows = rows.filter(status__in=statuses)
    query = (query or "").strip()[:MAX_QUERY]
    if query:
        rows = rows.filter(Q(title__icontains=query) | Q(excerpt__icontains=query))
    if format_key in PostFormat.values:
        rows = rows.filter(format=format_key)
    if author_id and Author.objects.filter(pk=_uuid_or_none(author_id)).exists():
        rows = rows.filter(author_links__author_id=author_id)
    if topic_id and Topic.objects.filter(pk=_uuid_or_none(topic_id)).exists():
        rows = rows.filter(topic_links__topic_id=topic_id)
    return (
        rows.distinct()
        .defer("body_md", "published_snapshot")
        .prefetch_related("author_links__author")
        .order_by("-updated_at")
    )


def _uuid_or_none(value: str):
    import uuid

    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None
