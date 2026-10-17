"""One person, one user (ADR-049, decision 7): link team members and Insights authors to users.

A team member is linked to the user with the same email address (case-insensitive). Insights authors
have no email field, so a person author is linked to the user whose full name matches exactly
(case- and space-insensitive), or to the user already linked to a team member of that name.
Nothing is ever unlinked or overwritten: an existing link that disagrees is reported, not changed.
"""

from dataclasses import dataclass, field

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.audit.services import record


def _norm(value: str) -> str:
    return " ".join((value or "").split()).casefold()


@dataclass
class LinkReport:
    team_linked: list[tuple[str, str]] = field(default_factory=list)
    authors_linked: list[tuple[str, str]] = field(default_factory=list)
    already_linked: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    unmatched_team: list[str] = field(default_factory=list)
    unmatched_authors: list[str] = field(default_factory=list)
    users_without_team_member: list[str] = field(default_factory=list)

    @property
    def changes(self) -> int:
        return len(self.team_linked) + len(self.authors_linked)

    def lines(self) -> list[str]:
        out = []
        for member, user in self.team_linked:
            out.append(f"link team member  {member} -> {user}")
        for author, user in self.authors_linked:
            out.append(f"link author       {author} -> {user}")
        out += [f"already linked    {item}" for item in self.already_linked]
        out += [f"conflict          {item}" for item in self.conflicts]
        out += [f"unmatched member  {item}" for item in self.unmatched_team]
        out += [f"unmatched author  {item}" for item in self.unmatched_authors]
        out += [f"user, no member   {item}" for item in self.users_without_team_member]
        return out


def link_people(*, apply: bool = False, actor=None) -> LinkReport:
    """Work out (and with ``apply=True`` make) the missing user links. Returns what it found."""
    from apps.architecture.models import TeamMember
    from apps.insights.models import Author, AuthorKind

    User = get_user_model()
    report = LinkReport()
    users = list(User.objects.filter(is_active=True).order_by("email"))
    by_email = {user.email.lower(): user for user in users}
    by_name: dict[str, list] = {}
    for user in users:
        if user.full_name:
            by_name.setdefault(_norm(user.full_name), []).append(user)
    claimed_users = set(TeamMember.objects.exclude(user=None).values_list("user_id", flat=True))
    member_user_by_name: dict[str, object] = {}
    linked_author_emails: list[str] = []

    with transaction.atomic():
        for member in TeamMember.objects.filter(is_archived=False).select_related("user").order_by("name"):
            label = f"{member.name} <{member.email or 'no email'}>"
            if member.user_id:
                member_user_by_name[_norm(member.name)] = member.user
                if member.email and member.user.email.lower() != member.email.lower():
                    report.conflicts.append(f"{label} is linked to {member.user.email}")
                else:
                    report.already_linked.append(label)
                continue
            user = by_email.get((member.email or "").lower()) if member.email else None
            if user is None:
                report.unmatched_team.append(label)
                continue
            if user.pk in claimed_users:
                report.conflicts.append(f"{label}: {user.email} is already linked to another team member")
                continue
            claimed_users.add(user.pk)
            member_user_by_name[_norm(member.name)] = user
            report.team_linked.append((label, user.email))
            if apply:
                member.user = user
                member.save(update_fields=["user", "updated_at"])

        for author in Author.objects.filter(kind=AuthorKind.PERSON).select_related("admin_user"):
            label = f"{author.name} ({author.slug})"
            if author.admin_user_id:
                report.already_linked.append(f"author {label} -> {author.admin_user.email}")
                continue
            candidates = by_name.get(_norm(author.name), [])
            user = candidates[0] if len(candidates) == 1 else member_user_by_name.get(_norm(author.name))
            if user is None:
                reason = "several users share the name" if len(candidates) > 1 else "no user with that name"
                report.unmatched_authors.append(f"{label}: {reason}")
                continue
            note = " (name taken from the email address, not yet confirmed)" if user.name_needs_review else ""
            report.authors_linked.append((label, f"{user.email}{note}"))
            if apply:
                Author.objects.filter(pk=author.pk, admin_user__isnull=True).update(admin_user=user)
                linked_author_emails.append(user.email)

        for user in users:
            if user.pk not in claimed_users:
                report.users_without_team_member.append(user.email)

        if apply and report.changes:
            record(
                "users.people_linked",
                actor=actor,
                summary=f"Linked {len(report.team_linked)} team member(s) and "
                f"{len(report.authors_linked)} author(s) to users",
                team=[email for _, email in report.team_linked],
                authors=linked_author_emails,
            )
    return report
