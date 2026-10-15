"""Seeds the local Super Admin for the two-app content suites (tests/content-sync).

Run from superadmin/ with the E2E database:  python manage.py shell -c "exec(open(PATH).read())"
Prints one JSON line (ids and slugs) for the Playwright specs. Every value is an obviously
fictional fixture; this must never run against a production database (it refuses unless the
database is SQLite or the APP_ENVIRONMENT is development).
"""

import json
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from apps.accounts.roles import SUPERADMIN
from apps.insights import services
from apps.insights.models import CheckKey, Post, Topic
from apps.careers import config as careers_config
from apps.careers.models import CareersSettings, Role
from tests.content_helpers import make_author, make_post, make_role, open_site

engine = settings.DATABASES["default"]["ENGINE"]
if "sqlite" not in engine and settings.APP_ENVIRONMENT != "development":
    raise SystemExit("seed.py refuses to run outside a local development database")

COUNT = int(os.environ.get("E2E_SEED_POSTS", "24"))
EMAIL = os.environ["E2E_ADMIN_EMAIL"]
PASSWORD = os.environ["E2E_ADMIN_PASSWORD"]

User = get_user_model()
user, _ = User.objects.get_or_create(email=EMAIL, defaults={"is_active": True})
user.set_password(PASSWORD)
user.is_active = True
user.save()
user.groups.add(Group.objects.get_or_create(name=SUPERADMIN)[0])

open_site(insights=True, careers=True)
author = make_author("Example Author", actor=user, slug="example-author")
topic = Topic.objects.get(slug="ai-and-agents")

posts = []
for index in range(1, COUNT + 1):
    slug = f"example-sync-post-{index}"
    existing = Post.objects.filter(slug=slug).first()
    post = existing or make_post(
        f"Example sync post {index} (fixture)",
        user,
        authors=[author],
        topics=[topic],
        slug=slug,
    )
    if post.status == "draft":
        services.submit_for_review(post, user)
        services.approve(Post.objects.get(pk=post.pk), user)
    post = Post.objects.get(pk=post.pk)
    for key in CheckKey.values:
        services.tick_check(post, key, user)
    posts.append({"id": str(post.pk), "slug": post.slug, "title": post.title})

# Careers: a test-only privacy notice (the form is offered only when one is set) and one draft
# role the careers suite opens through the admin.
settings_row, _ = CareersSettings.objects.get_or_create(pk=1)
config = careers_config.load()
config.update(privacy_notice_url="/legal/privacy", privacy_notice_version="e2e-fixture")
config.pop("candidate_emails_enabled", None)
settings_row.config = config
settings_row.save()
role = Role.objects.filter(title="Example role (fixture)").first() or make_role(
    "Example role (fixture)", status="draft", actor=user
)
role_seed = {"id": str(role.pk), "slug": role.slug, "title": role.title}

print(
    "SEED_JSON "
    + json.dumps({"posts": posts, "author": author.slug, "topic": topic.slug, "role": role_seed})
)
