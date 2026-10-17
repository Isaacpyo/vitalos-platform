"""The Insights editor form and page (finding F4): one ordered author list of confirmed authors, the
styled cover file control, the word count under the editor, and the balanced two-column layout."""

import re
from pathlib import Path

import pytest
from django.urls import reverse

from apps.content_sync import formatting, render
from apps.insights import services
from apps.insights.forms import MAX_AUTHORS, PostForm
from apps.insights.models import Author

from .content_helpers import configure, make_author, make_post, ok_render

pytestmark = pytest.mark.django_db

EDITOR_JS = Path(__file__).resolve().parents[1] / "static" / "js" / "insights-editor.js"


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)


@pytest.fixture
def people(superadmin):
    return {
        "ada": make_author("Ada Example", actor=superadmin, slug="ada-example"),
        "ben": make_author("Ben Example", actor=superadmin, slug="ben-example"),
        "cy": make_author("Cy Example", actor=superadmin, slug="cy-example"),
        "unconfirmed": make_author("Dee Unconfirmed", confirmed=False, slug="dee-unconfirmed"),
    }


def _data(post, authors, **changes):
    data = {
        "title": post.title,
        "body_md": post.body_md,
        "format": post.format,
        "slug": post.slug,
        "practice": post.practice,
        "updated_at": post.updated_at.isoformat(),
        "authors": [str(author.pk) for author in authors],
    }
    data.update(changes)
    return data


def _ids(authors):
    return [str(author.pk) for author in authors]


def test_the_author_list_offers_confirmed_authors_with_the_posts_own_first(superadmin, people):
    post = make_post("Example draft (fixture)", superadmin, authors=[people["cy"], people["unconfirmed"]])
    form = PostForm(post=post)
    choices = form.fields["authors"].choices
    keys = [key for key, _ in choices]
    # The post's authors first, in byline order (even one not yet confirmed), then the rest by name.
    assert keys == _ids([people["cy"], people["unconfirmed"], people["ada"], people["ben"]])
    assert dict(choices)[str(people["unconfirmed"].pk)] == "Dee Unconfirmed (not confirmed)"
    assert form.initial["authors"] == _ids([people["cy"], people["unconfirmed"]])
    # An unconfirmed author who is not on the post is not offered.
    other = make_post("Example other (fixture)", superadmin)
    assert str(people["unconfirmed"].pk) not in dict(PostForm(post=other).fields["authors"].choices)
    assert not any(name.startswith("author_") for name in form.fields)


def test_saving_keeps_the_submitted_byline_order(superadmin, people, client_for):
    client = client_for(superadmin)
    post = make_post("Example draft (fixture)", superadmin, authors=[people["ada"]])
    url = reverse("insights:post", args=[post.pk])
    order = [people["ben"], people["ada"], people["cy"]]
    response = client.post(url, _data(post, order))
    assert response.status_code == 302
    post.refresh_from_db()
    assert services.author_ids(post) == _ids(order)  # Ben is the lead author

    # Reordering through autosave (what the editor's move buttons do) changes the lead author.
    reordered = [people["cy"], people["ben"]]
    response = client.post(reverse("insights:post_autosave", args=[post.pk]), _data(post, reordered))
    assert response.status_code == 200 and response.json()["ok"]
    post.refresh_from_db()
    assert services.author_ids(post) == _ids(reordered)

    # The page lists the chosen authors first, in that order, so the next save keeps it.
    page = client.get(url).content.decode()
    positions = [
        page.index(f'value="{author.pk}"') for author in (people["cy"], people["ben"], people["ada"])
    ]
    assert positions == sorted(positions)


def test_more_than_the_maximum_number_of_authors_is_refused(superadmin, people, client_for):
    extra = [make_author(f"Extra Example {n}", actor=superadmin, slug=f"extra-example-{n}") for n in range(2)]
    post = make_post("Example draft (fixture)", superadmin, authors=[people["ada"]])
    too_many = [people["ada"], people["ben"], people["cy"], *extra]
    assert len(too_many) == MAX_AUTHORS + 1
    form = PostForm(_data(post, too_many), post=post)
    assert not form.is_valid()
    assert form.errors["authors"] == [f"Choose at most {MAX_AUTHORS} authors."]

    client = client_for(superadmin)
    response = client.post(reverse("insights:post_autosave", args=[post.pk]), _data(post, too_many))
    assert response.status_code == 400 and "authors" in response.json()["errors"]
    page = client.post(reverse("insights:post", args=[post.pk]), _data(post, too_many))
    assert page.status_code == 400 and f"Choose at most {MAX_AUTHORS} authors." in page.content.decode()
    post.refresh_from_db()
    assert services.author_ids(post) == _ids([people["ada"]])


def test_unknown_or_unconfirmed_authors_cannot_be_added(superadmin, people):
    post = make_post("Example draft (fixture)", superadmin, authors=[people["ada"]])
    assert not PostForm(_data(post, [people["unconfirmed"]]), post=post).is_valid()
    Author.objects.filter(pk=people["ben"].pk).update(is_active=False)
    assert not PostForm(_data(post, [people["ben"]]), post=post).is_valid()
    # No authors at all is allowed in a draft (the Authors check blocks publishing instead).
    empty = PostForm(_data(post, []), post=post)
    assert empty.is_valid() and empty.authors() == []


def test_the_editor_page_has_the_author_list_cover_control_and_word_count(
    superadmin, people, client_for, settings
):
    settings.CONTENT_MEDIA_STORAGE_ENABLED = True
    post = make_post("Example draft (fixture)", superadmin, authors=[people["ada"]])
    page = client_for(superadmin).get(reverse("insights:post", args=[post.pk])).content.decode()
    assert "data-author-picker" in page and 'name="author_1"' not in page
    assert page.count('name="authors"') == 3  # Ada, Ben, Cy (the unconfirmed author is not offered)
    assert re.search(
        r'<input[^>]+name="authors"[^>]+form="post-form"|form="post-form"[^>]+name="authors"', page
    )
    # The styled file control wraps the native input (it still works without JavaScript).
    assert "data-file-drop" in page and "data-drop-zone" in page
    assert re.search(r'<input id="cover-image" type="file" name="image"[^>]*required', page)
    assert "data-file-preview" in page
    # Word count and reading time under the editor.
    assert 'data-testid="word-count"' in page and "data-word-count" in page
    # Layout: the secondary panels sit under the editor; the settings rail spans both rows.
    assert page.index('id="seo-heading"') < page.index('aria-label="Post settings"')
    assert "xl:row-span-2" in page


def test_the_word_count_uses_the_websites_reading_time_rule():
    """The editor's script counts words and minutes exactly as formatting.reading_minutes does."""
    script = EDITOR_JS.read_text(encoding="utf-8")
    match = re.search(r"var WORD_RE = /(.+)/g;", script)
    assert match
    js_pattern = re.sub(r"\\u([0-9A-Fa-f]{4})", lambda m: chr(int(m.group(1), 16)), match.group(1))
    assert js_pattern == formatting.WORD_RE.pattern
    assert "var WORDS_PER_MINUTE = 220;" in script
    assert "Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))" in script
    assert formatting.reading_minutes("word " * 221) == 2 and formatting.reading_minutes("") == 1
