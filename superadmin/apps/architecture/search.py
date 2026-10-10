"""Global search across the architecture. PostgreSQL full-text search; icontains fallback on SQLite."""

import re
from dataclasses import dataclass, field
from functools import reduce
from operator import and_, or_

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import connection
from django.db.models import Q

from .models import KPI, Decision, Offer, Practice, Project, ServiceLine, Solution, TeamMember
from .selectors import visible

#: (label, model, weighted fields, select_related)
SEARCHABLE = [
    ("Service lines", ServiceLine, {"A": ["name"], "B": ["tagline"]}, []),
    ("Practices", Practice, {"A": ["name"], "B": ["summary"]}, ["service_line"]),
    ("Solutions", Solution, {"A": ["name"], "B": ["summary"]}, ["practice__service_line"]),
    ("Offers", Offer, {"A": ["name"], "B": ["summary"]}, ["solution__practice__service_line"]),
    ("Projects", Project, {"A": ["name"], "B": ["client"]}, ["service_line"]),
    ("KPIs", KPI, {"A": ["name"], "B": ["unit"]}, ["service_line"]),
    ("Decisions", Decision, {"A": ["title"], "B": ["rationale"]}, ["service_line"]),
    ("Team", TeamMember, {"A": ["name"], "B": ["role_title", "email"]}, []),
]

MAX_TERMS = 8


@dataclass
class SearchGroup:
    label: str
    results: list = field(default_factory=list)


def tokens(query: str) -> list[str]:
    return re.findall(r"\w+", (query or "").lower())[:MAX_TERMS]


def _postgres(queryset, weighted: dict[str, list[str]], terms: list[str]):
    vector = reduce(
        lambda acc, item: acc + item,
        [
            SearchVector(name, weight=weight, config="english")
            for weight, names in weighted.items()
            for name in names
        ],
    )
    # Prefix matching ("eng" finds "Engineering") so results update while the user types.
    raw = " & ".join(f"{term}:*" for term in terms)
    query = SearchQuery(raw, search_type="raw", config="english")
    return (
        queryset.annotate(search=vector, rank=SearchRank(vector, query))
        .filter(search=query)
        .order_by("-rank", "pk")
    )


def _fallback(queryset, weighted: dict[str, list[str]], terms: list[str]):
    names = [name for names in weighted.values() for name in names]
    clauses = [reduce(or_, [Q(**{f"{name}__icontains": term}) for name in names]) for term in terms]
    return queryset.filter(reduce(and_, clauses)).order_by("pk")


def search(user, query: str, per_group: int = 5) -> list[SearchGroup]:
    terms = tokens(query)
    if not terms:
        return []
    engine = _postgres if connection.vendor == "postgresql" else _fallback
    groups = []
    for label, model, weighted, related in SEARCHABLE:
        queryset = visible(model.objects.active(), user)
        if related:
            queryset = queryset.select_related(*related)
        results = list(engine(queryset, weighted, terms)[:per_group])
        if results:
            groups.append(SearchGroup(label=label, results=results))
    return groups
