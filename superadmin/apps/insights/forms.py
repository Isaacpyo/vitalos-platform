from django import forms
from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_datetime

from apps.content_sync.choices import Practice
from apps.core.forms import INPUT, StyledFormMixin

from . import public
from .models import Author, AuthorKind, Post, PostFormat, Topic, TopicKind

MAX_AUTHORS = 4
MAX_RELATED = 3
EDITOR_FORM = "post-form"


class NewPostForm(StyledFormMixin, forms.Form):
    title = forms.CharField(max_length=200)
    format = forms.ChoiceField(choices=PostFormat.choices, initial=PostFormat.INSIGHT_ARTICLE)


class PostForm(StyledFormMixin, forms.Form):
    """The editor's working copy. Rail fields sit outside the <form> and join it with form="post-form"."""

    title = forms.CharField(max_length=200, required=False)
    body_md = forms.CharField(label="Body", max_length=200_000, required=False, widget=forms.Textarea())
    format = forms.ChoiceField(choices=PostFormat.choices)
    slug = forms.CharField(max_length=80, required=False)
    practice = forms.ChoiceField(choices=[("", "None")] + Practice.choices, required=False)
    topics = forms.MultipleChoiceField(required=False, widget=forms.CheckboxSelectMultiple)
    cover_alt = forms.CharField(label="Alt text", max_length=300, required=False)
    cover_caption = forms.CharField(label="Caption", max_length=300, required=False)
    featured = forms.BooleanField(label="Featured on the Insights index", required=False)
    pin_home = forms.BooleanField(label="Pin to homepage", required=False)
    cta_label = forms.CharField(label="Label", max_length=80, required=False)
    cta_href = forms.CharField(label="Link", max_length=300, required=False)
    seo_title = forms.CharField(
        label="SEO title",
        max_length=200,
        required=False,
        widget=forms.TextInput(attrs={"data-counter": "60"}),
    )
    seo_description = forms.CharField(
        label="SEO description",
        max_length=320,
        required=False,
        widget=forms.Textarea(attrs={"data-counter": "160"}),
    )
    canonical_url = forms.CharField(label="Canonical URL", max_length=500, required=False)
    noindex = forms.BooleanField(label="Hide from search engines (noindex)", required=False)
    material_update = forms.BooleanField(label="This is a material update", required=False)
    updated_at = forms.CharField(required=False, widget=forms.HiddenInput)
    force = forms.BooleanField(required=False, widget=forms.HiddenInput)

    def __init__(self, *args, post: Post, **kwargs):
        super().__init__(*args, **kwargs)
        self.post = post
        current_authors = public.working_authors(post)
        author_choices = [("", "None")] + [
            (str(author.pk), f"{author.name}{'' if author.is_confirmed else ' (not confirmed)'}")
            for author in Author.objects.filter(is_active=True).order_by("name")
        ]
        known = {value for value, _ in author_choices}
        author_choices += [
            (str(a.pk), f"{a.name} (inactive)") for a in current_authors if str(a.pk) not in known
        ]
        for index in range(1, MAX_AUTHORS + 1):
            label = "Lead author" if index == 1 else f"Author {index}"
            self.fields[f"author_{index}"] = forms.ChoiceField(
                label=label, choices=author_choices, required=False
            )
        self.fields["topics"].choices = [
            (str(topic.pk), f"{topic.name}{' (sector)' if topic.kind == TopicKind.SECTOR else ''}")
            for topic in Topic.objects.order_by("kind", "sort", "name")
        ]
        related_choices = [("", "Automatic (shared topics)")] + [
            (str(item.pk), item.title)
            for item in public.visible_posts()
            .exclude(pk=post.pk)
            .only("id", "title")
            .order_by("-first_published_at")[:200]
        ]
        for index in range(1, MAX_RELATED + 1):
            self.fields[f"related_{index}"] = forms.ChoiceField(
                label=f"Related post {index}", choices=related_choices, required=False
            )
        if not self.is_bound:
            self.initial.update(
                {
                    "title": post.title,
                    "body_md": post.body_md,
                    "format": post.format,
                    "slug": post.slug,
                    "practice": post.practice,
                    "topics": [str(pk) for pk in post.topic_links.values_list("topic_id", flat=True)],
                    "cover_alt": post.cover_alt,
                    "cover_caption": post.cover_caption,
                    "featured": post.featured,
                    "pin_home": post.pin_home,
                    "cta_label": post.cta_label,
                    "cta_href": post.cta_href,
                    "seo_title": post.seo_title,
                    "seo_description": post.seo_description,
                    "canonical_url": post.canonical_url,
                    "noindex": post.noindex,
                    "material_update": post.material_update,
                    "updated_at": post.updated_at.isoformat(),
                }
            )
            for index, author in enumerate(current_authors[:MAX_AUTHORS], start=1):
                self.initial[f"author_{index}"] = str(author.pk)
            related = list(post.related_links.order_by("position").values_list("related_post_id", flat=True))
            for index, pk in enumerate(related[:MAX_RELATED], start=1):
                self.initial[f"related_{index}"] = str(pk)
        for name, field in self.fields.items():
            field.widget.attrs["form"] = EDITOR_FORM
            if isinstance(field.widget, forms.Select):
                field.widget.attrs.setdefault("class", INPUT)  # fields added after StyledFormMixin ran
            if name == "body_md":
                field.widget.attrs.update(
                    {
                        "rows": 24,
                        "data-md-editor": "",
                        "spellcheck": "true",
                        "class": INPUT + " font-mono text-[13px] leading-6",
                    }
                )

    def working_data(self) -> dict:
        data = {
            key: self.cleaned_data[key]
            for key in (
                "title",
                "body_md",
                "format",
                "slug",
                "practice",
                "cover_alt",
                "cover_caption",
                "featured",
                "pin_home",
                "cta_label",
                "cta_href",
                "seo_title",
                "seo_description",
                "canonical_url",
                "noindex",
                "material_update",
            )
        }
        data["slug"] = (data["slug"] or "").strip()
        for key in (
            "cta_label",
            "cta_href",
            "seo_title",
            "seo_description",
            "canonical_url",
            "cover_alt",
            "cover_caption",
        ):
            data[key] = (data[key] or "").strip()
        return data

    def authors(self) -> list[str]:
        return [
            self.cleaned_data[f"author_{index}"]
            for index in range(1, MAX_AUTHORS + 1)
            if self.cleaned_data.get(f"author_{index}")
        ]

    def related(self) -> list[str]:
        return [
            self.cleaned_data[f"related_{index}"]
            for index in range(1, MAX_RELATED + 1)
            if self.cleaned_data.get(f"related_{index}")
        ]

    def expected_updated_at(self):
        if self.cleaned_data.get("force"):
            return None
        return parse_datetime(self.cleaned_data.get("updated_at") or "")


class CoverForm(forms.Form):
    image = forms.FileField()
    alt = forms.CharField(max_length=300)


class AuthorForm(StyledFormMixin, forms.Form):
    name = forms.CharField(max_length=120)
    kind = forms.ChoiceField(
        choices=AuthorKind.choices,
        initial=AuthorKind.PERSON,
        required=False,
        help_text="An organisation author (the Vitalos team) shows the Vitalos symbol instead of a photo.",
    )
    slug = forms.CharField(max_length=80, required=False, help_text="Lowercase letters, numbers and hyphens.")
    role_title = forms.CharField(label="Role title", max_length=120, required=False)
    bio_md = forms.CharField(
        label="Biography (Markdown)",
        max_length=5000,
        required=False,
        widget=forms.Textarea(attrs={"data-counter": "5000"}),
    )
    linkedin_url = forms.CharField(
        label="LinkedIn URL", max_length=300, required=False, help_text="https://www.linkedin.com/in/…"
    )
    admin_user = forms.ModelChoiceField(
        label="Dashboard user", queryset=None, required=False, empty_label="Not linked"
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["admin_user"].queryset = get_user_model().objects.filter(is_active=True).order_by("email")
        self.fields["bio_md"].widget.attrs["rows"] = 6

    def data_for_service(self, *, include_slug: bool) -> dict:
        data = dict(self.cleaned_data)
        data["slug"] = (data.get("slug") or "").strip()
        if not include_slug or not data["slug"]:
            data.pop("slug")
        if not data.get("kind"):
            data.pop("kind", None)  # left unchanged (a new author is a person)
        return data


class TopicForm(StyledFormMixin, forms.Form):
    name = forms.CharField(max_length=120)
    slug = forms.CharField(
        max_length=80, required=False, help_text="Changing a topic's slug changes its page address."
    )
    kind = forms.ChoiceField(choices=TopicKind.choices, initial=TopicKind.TOPIC)
    description = forms.CharField(max_length=1000, required=False, widget=forms.Textarea())

    def data_for_service(self, *, include_slug: bool) -> dict:
        data = dict(self.cleaned_data)
        data["slug"] = (data.get("slug") or "").strip()
        if not include_slug or not data["slug"]:
            data.pop("slug")
        return data


class HomeSectionForm(StyledFormMixin, forms.Form):
    enabled = forms.BooleanField(label="Show the Insights section on the homepage", required=False)
    heading = forms.CharField(max_length=200)
    intro = forms.CharField(max_length=500, widget=forms.Textarea())
    count = forms.TypedChoiceField(label="Posts shown", choices=[(n, str(n)) for n in (2, 3, 4)], coerce=int)
    mode = forms.ChoiceField(
        label="Selection",
        choices=[("latest", "Latest posts"), ("pinned", "Pinned posts first, then the latest")],
    )


class InsightsCopyForm(StyledFormMixin, forms.Form):
    heading = forms.CharField(max_length=200)
    intro = forms.CharField(max_length=500, widget=forms.Textarea())
    editorial_note = forms.CharField(
        label="Editorial note (end of every article)", max_length=1000, widget=forms.Textarea()
    )
    organisation_editorial_note = forms.CharField(
        label="Editorial note for organisation-authored articles",
        help_text="Shown instead of the note above when an article's only author is an organisation.",
        max_length=1000,
        widget=forms.Textarea(),
    )


class SiteStateForm(StyledFormMixin, forms.Form):
    insights_open = forms.BooleanField(label="Insights is open on the website", required=False)
    careers_open = forms.BooleanField(label="Careers is open on the website", required=False)
