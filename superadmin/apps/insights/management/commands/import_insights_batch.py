"""Import a folder of approved Insights through the editorial workflow (``apps/insights/importing.py``).

    manage.py import_insights_batch apps/insights/imports/insights-batch-2              # dry run
    manage.py import_insights_batch FOLDER --apply [--author SLUG|EMAIL] [--as-user EMAIL]
    manage.py import_insights_batch FOLDER --apply --status published                   # publishes

Without ``--apply`` it checks every file and prints what would happen, writing nothing. With ``--apply``
it creates or updates each post (matched by slug) as a **draft** (the default, ``--status draft``):
the working copy only, no editorial check ticked, nothing on the website. Publishing needs the
explicit ``--status published``, which ticks the checks and publishes each post with its original
date. ``--author`` puts every post under an existing person author instead of the files' "Vitalos"
organisation author. Any problem fails the whole run before anything is written. The report is
printed, and saved as IMPORT-REPORT.md in the folder (or ``--report``) after ``--apply``.
"""

from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.insights import access, importing
from apps.insights.models import PostStatus

DEFAULT_USER = "Temitope.agbola@vitalos.co.uk"


class Command(BaseCommand):
    help = "Import approved Insights (NN-slug.md files) as drafts, or publish them with --status published."

    def add_arguments(self, parser):
        parser.add_argument("folder", help="Folder of NN-slug.md files with YAML front matter.")
        parser.add_argument("--apply", action="store_true", help="Write (default: dry run).")
        parser.add_argument(
            "--status",
            choices=[PostStatus.DRAFT, PostStatus.PUBLISHED],
            default=PostStatus.DRAFT,
            help="draft (default): working copies only. published: tick the checks and publish.",
        )
        parser.add_argument(
            "--author",
            default="",
            help="An existing person author (slug, or their dashboard user's email) for every post, "
            "in place of the files' Vitalos organisation author.",
        )
        parser.add_argument(
            "--as-user", dest="as_user", default=DEFAULT_USER, help="Admin user the import acts as."
        )
        parser.add_argument("--report", help="Where to save the report (default: FOLDER/IMPORT-REPORT.md).")

    def handle(
        self,
        *args,
        folder,
        apply=False,
        status=PostStatus.DRAFT,
        author="",
        as_user=DEFAULT_USER,
        **options,
    ):
        user = get_user_model().objects.filter(email__iexact=as_user.strip(), is_active=True).first()
        if user is None:
            raise CommandError(f"No active admin user with the email {as_user}.")
        publishing = status == PostStatus.PUBLISHED
        if publishing and not access.can_publish(user):
            raise CommandError(f"{user.email} may not publish Insights.")
        if not access.can_edit(user):
            raise CommandError(f"{user.email} may not edit Insights.")

        self.stdout.write(f"Checking {folder} ...")
        try:
            items = importing.load(Path(folder))
        except importing.BatchError as exc:
            raise CommandError(self._problems(exc.problems)) from None
        problems = importing.plan(items, status, author)
        author_note = importing.author_plan(status, author)
        if author_note.startswith("refuse"):
            problems.append(author_note.removeprefix("refuse: "))
        must_render = apply and publishing
        render_problems, reachable = importing.render_problems(items, required=must_render)
        problems += render_problems
        if problems:
            raise CommandError(self._problems(problems))
        if not reachable:
            self.stdout.write("The website's renderer is not reachable: bodies were not rendered.")

        if apply:
            try:
                importing.apply(items, actor=user, status=status, author=author)
            except importing.BatchError as exc:
                raise CommandError(self._problems(exc.problems)) from None
        text = importing.report(
            items, applied=apply, status=status, actor_email=user.email, author_note=author_note
        )
        self.stdout.write(text)
        if apply:
            target = Path(options.get("report") or Path(folder) / "IMPORT-REPORT.md")
            try:
                target.write_text(text, encoding="utf-8", newline="\n")
            except OSError as exc:
                self.stderr.write(f"Could not save the report to {target} ({exc.__class__.__name__}).")
            else:
                self.stdout.write(f"Saved {target}")
        counts: dict[str, int] = {}
        for item in items:
            counts[item.action] = counts.get(item.action, 0) + 1
        summary = ", ".join(f"{action}: {count}" for action, count in sorted(counts.items()))
        mode = "Imported" if apply else "Dry run (use --apply to write)"
        self.stdout.write(f"{mode}: {len(items)} posts, status {status} ({summary}).")

    @staticmethod
    def _problems(problems: list[str]) -> str:
        return "Nothing was imported:\n" + "\n".join(f"  - {problem}" for problem in problems)
