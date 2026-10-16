"""Careers plumbing used by the read API and the tick (the Careers admin is Phase 4)."""

import pytest
from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError

from apps.careers import access, public, services
from apps.careers import config as careers_config
from apps.careers.models import Role, RoleRevision, RoleStatus
from apps.content_sync.models import SlugRedirect, SyncEvent

from .content_helpers import make_role, ok_render

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _render(monkeypatch):
    from apps.content_sync import render

    monkeypatch.setattr(render, "render", ok_render)


def test_open_role_validates_like_the_brief(superadmin):
    role = make_role(status="draft", summary="", show_salary=True, salary_min=50, salary_max=10)
    with pytest.raises(ValidationError) as caught:
        services.open_role(role, superadmin)
    text = " ".join(caught.value.messages)
    assert "summary" in text and "salary" in text
    role.summary = "Example summary (fixture)."
    role.salary_max = 60
    role.apply_mode = "external"
    role.external_apply_url = "http://example.test/apply"
    role.save()
    with pytest.raises(ValidationError, match="https"):
        services.open_role(role, superadmin)
    role.external_apply_url = "https://example.test/apply"
    role.save()
    role = services.open_role(role, superadmin)
    assert (
        role.status == RoleStatus.OPEN
        and role.published_snapshot["apply"]["externalUrl"] == "https://example.test/apply"
    )
    assert RoleRevision.objects.filter(role=role).count() == 1
    assert SyncEvent.objects.filter(entity_id=str(role.pk), action="role.opened").exists()


def test_role_slug_change_on_republish_creates_a_redirect(superadmin):
    role = make_role(actor=superadmin)
    old = role.published_slug
    services.close_role(role, superadmin)
    role = Role.objects.get(pk=role.pk)
    role.slug = "example-role-renamed"
    role.save()
    services.open_role(role, superadmin)
    assert SlugRedirect.objects.get(entity="role", from_slug=old).to_id == role.pk
    assert public.role_detail(old) == {"redirect": "example-role-renamed"}


def test_role_detail_fills_settings_and_hides_what_is_not_shown(superadmin):
    role = make_role(actor=superadmin, show_level=False, sponsorship="available")
    detail = public.role_detail(role.published_slug)
    assert detail["level"] is None and detail["salary"] is None
    assert detail["sponsorship"] == {"key": "available", "label": "Available"}
    assert detail["privacy"] == {"noticeUrl": "/legal/candidate-privacy", "noticeVersion": "2026-10-careers"}
    assert detail["sections"]["process"] == ""
    # The owner-approved statement (careers migration 0005) shows on every role.
    assert detail["sections"]["equalOpportunities"].startswith("Vitalos welcomes applications")


def test_careers_config_validation():
    with pytest.raises(ValidationError):
        careers_config.clean({"retention_months": 0})
    with pytest.raises(ValidationError):
        careers_config.clean({"privacy_notice_url": "javascript:alert(1)"})
    cleaned = careers_config.clean({"values": "One\nTwo\n\n", "associates_line_enabled": "on"})
    assert cleaned["values"] == ["One", "Two"] and cleaned["associates_line_enabled"] is True


def test_careers_access_predicates(superadmin, viewer):
    assert access.can_view_roles(viewer) and not access.can_edit_roles(viewer)
    assert not access.can_view_applications(viewer) and not access.can_view_cv(viewer)
    assert access.can_view_cv(superadmin) and access.can_delete_applications(superadmin)
    viewer.user_permissions.add(Permission.objects.get(codename="view_application"))
    viewer = type(viewer).objects.get(pk=viewer.pk)
    assert access.can_view_applications(viewer) and not access.can_view_cv(viewer)
    viewer.user_permissions.add(Permission.objects.get(codename="view_cv"))
    viewer = type(viewer).objects.get(pk=viewer.pk)
    assert access.can_view_cv(viewer)
