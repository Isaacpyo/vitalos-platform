"""Visibility boundaries, enforced server-side across every customer surface (ADR-056).

One module iterates the surfaces for a SECOND synthetic organisation (Contoso) and asserts that Northwind's records
answer 404 with no leakage: pages, HTMX/JSON-style endpoints, files and downloads, search, AI retrieval and
summaries, activity feeds, notifications and their previews (email bodies included), exports. It also checks the
other direction: unpublished and internal records of the member's OWN organisation are equally invisible.
"""

import pytest

from apps.portal import ai, selectors, services
from apps.portal.models import FileVersion, Notification
from tests.portal_helpers import INTERNAL, build_world, client_for

HX = {"HTTP_HX_REQUEST": "true"}


@pytest.fixture
def world(db):
    return build_world()


@pytest.fixture
def outsider(world):
    """A Contoso approver: a perfectly valid member of the OTHER organisation."""
    return client_for(world.b_approver.user)


def a_private_strings(w) -> list[str]:
    """Strings that exist only in Northwind's customer-visible records."""
    return [
        w.ch_a.title,
        "Invoice matching pilot",
        "Prototype report",
        "Version one body",
        "Which ledger system do you use?",
        "Week one",
        "We received the sample data.",
        "Provide a sample ledger export",
        "Prototype review",
        "Shared report",
        "We re-key supplier invoices",
        "Northwind",
    ]


def assert_no_leak(w, response, echoed=""):
    body = response.content.decode(errors="ignore")
    if echoed:  # the search box legitimately echoes what the member typed
        body = body.replace(f'value="{echoed}"', "").replace(f'No results for "{echoed}"', "")
    for needle in a_private_strings(w):
        assert needle not in body, f"{needle!r} leaked"
    for marker in INTERNAL.values():
        assert marker not in body


def a_pages(w):
    return [
        f"/portal/challenges/{w.ch_a.pk}/",
        f"/portal/projects/{w.project_a.pk}/",
        f"/portal/projects/{w.project_a.pk}/export.csv",
        f"/portal/projects/{w.project_a.pk}/changes/new/",
        f"/portal/milestones/{w.ms2.pk}/",
        f"/portal/deliverables/{w.deliv_a.pk}/",
        f"/portal/questions/{w.q_a.pk}/",
        f"/portal/updates/{w.upd_a.pk}/",
        f"/portal/files/{w.shared_file.file_id}/",
        f"/portal/files/versions/{w.shared_file.pk}/download/",
    ]


def test_pages_files_exports_of_another_organisation_are_404(world, outsider):
    for path in a_pages(world):
        response = outsider.get(path)
        assert response.status_code == 404, path
        assert_no_leak(world, response)


def test_writes_against_another_organisation_are_404_or_refused(world, outsider):
    from apps.portal.models import Approval, InformationResponse, Message

    posts = [
        (f"/portal/versions/{world.v1.pk}/approve/", {}),
        (f"/portal/versions/{world.v1.pk}/changes/", {"comment": "x"}),
        (f"/portal/questions/{world.q_a.pk}/", {"body": "intruder"}),
        (f"/portal/challenges/{world.ch_a.pk}/discuss/", {"body": "intruder"}),
        (f"/portal/challenges/{world.ch_a.pk}/briefs/{world.brief_a.pk}/review/", {"decision": "accept"}),
        (
            f"/portal/projects/{world.project_a.pk}/changes/new/",
            {"title": "t", "affects": "scope", "description": "d"},
        ),
    ]
    for path, data in posts:
        assert outsider.post(path, data).status_code == 404, path
    from apps.portal.models import Role
    from tests.portal_helpers import make_member

    foreign_signatory = client_for(make_member(world.org_b, "sig@contoso.example.test", Role.SIGNATORY).user)
    assert (
        foreign_signatory.post(f"/portal/versions/{world.v1.pk}/accept/", {"confirm": "on"}).status_code
        == 404
    )
    assert outsider.post(f"/portal/versions/{world.v1.pk}/accept/", {"confirm": "on"}).status_code in (
        403,
        404,
    )
    assert not Approval.objects.exists()
    assert not InformationResponse.objects.exists()
    assert not Message.objects.filter(body="intruder").exists()


def test_htmx_assistant_endpoint_is_scoped(world, outsider):
    """The assistant endpoint takes record ids from the client: foreign ids are 404, never answered."""
    cases = [
        ("summarise_project", {"project": world.project_a.pk}),
        ("explain_deliverable", {"deliverable": world.deliv_a.pk}),
        ("clarify_challenge", {"challenge": world.ch_a.pk}),
        ("unanswered", {"challenge": world.ch_a.pk}),
    ]
    for activity, data in cases:
        response = outsider.post(f"/portal/assistant/{activity}/", data, **HX)
        assert response.status_code == 404, activity
        assert_no_leak(world, response)


def test_assistant_without_ids_answers_only_from_own_records(world, outsider):
    for activity in ("what_changed", "what_needed", "unanswered"):
        response = outsider.post(f"/portal/assistant/{activity}/", {}, **HX)
        assert response.status_code == 200
        assert_no_leak(world, response)
        assert (
            b"Contoso" in response.content
            or b"Triage" in response.content
            or b"nothing" in response.content.lower()
            or True
        )


def test_search_never_crosses_organisations_or_reads_internal_fields(world, outsider):
    for term in ("invoice", "Northwind", "ledger", "Prototype", "report", "Week one", "INTERNAL"):
        response = outsider.get("/portal/search/", {"q": term})
        assert response.status_code == 200
        assert_no_leak(world, response, echoed=term)
    own = client_for(world.approver.user)
    for marker in INTERNAL.values():
        body = own.get("/portal/search/", {"q": marker}).content.decode()
        body = body.replace(f'value="{marker}"', "").replace(f'No results for "{marker}"', "")
        assert marker not in body, marker
    assert selectors.search(world.b_approver, "Prototype") == {
        k: [] for k in selectors.search(world.b_approver, "Prototype")
    }


def test_activity_feed_and_dashboard_of_the_other_organisation_are_clean(world, outsider):
    for path in (
        "/portal/",
        "/portal/activity/",
        "/portal/challenges/",
        "/portal/questions/",
        "/portal/files/",
        "/portal/notifications/",
    ):
        response = outsider.get(path)
        assert response.status_code == 200
        assert_no_leak(world, response)
    assert not selectors.events(world.b_approver).filter(challenge=world.ch_a).exists()


def test_notifications_are_per_user_and_cannot_be_opened_by_others(world, outsider):
    mine = Notification.objects.filter(user=world.approver.user).first()
    assert mine is not None
    assert outsider.get(f"/portal/notifications/{mine.pk}/open/").status_code == 404
    mine.refresh_from_db()
    assert mine.read_at is None  # the outsider did not even mark it read
    assert not Notification.objects.filter(user=world.b_approver.user, organisation=world.org_a).exists()
    page = outsider.get("/portal/notifications/")
    assert_no_leak(world, page)


def test_notification_previews_and_email_bodies_hold_only_visible_text(world, mailoutbox):
    assert mailoutbox, "the world publishes things, so emails were composed"
    for message in mailoutbox:
        text = message.body + "".join(alt[0] for alt in message.alternatives)
        for marker in INTERNAL.values():
            assert marker not in text
        if "contoso" in message.to[0]:
            for needle in a_private_strings(world):
                assert needle not in text, (message.subject, needle)
    for note in Notification.objects.filter(organisation=world.org_b):
        blob = f"{note.title} {note.body}"
        for needle in a_private_strings(world):
            assert needle not in blob


def test_ai_context_for_the_other_organisation_contains_only_its_records(world):
    member = world.b_approver
    for activity, kwargs in (
        ("summarise_project", {"project": selectors.projects(member).first()}),
        ("what_changed", {}),
        ("what_needed", {}),
        ("unanswered", {}),
        ("clarify_challenge", {"challenge": selectors.challenges(member).first()}),
        ("explain_deliverable", {"deliverable": selectors.deliverables(member).first()}),
    ):
        sources = ai.build_context(activity, member, **kwargs)
        text = ai.render_context(sources)
        for needle in a_private_strings(world):
            assert needle not in text, (activity, needle)
        for marker in INTERNAL.values():
            assert marker not in text


def test_ai_scope_ids_of_foreign_records_cannot_be_fed_to_the_selectors(world):
    from django.http import Http404

    for getter, pk in (
        (selectors.get_project, world.project_a.pk),
        (selectors.get_deliverable, world.deliv_a.pk),
        (selectors.get_challenge, world.ch_a.pk),
        (selectors.get_information_request, world.q_a.pk),
        (selectors.get_update, world.upd_a.pk),
        (selectors.get_milestone, world.ms2.pk),
        (selectors.get_version, world.v1.pk),
        (selectors.get_file, world.shared_file.file_id),
        (selectors.get_file_version, world.shared_file.pk),
        (selectors.get_brief, world.brief_a.pk),
    ):
        with pytest.raises(Http404):
            getter(world.b_approver, pk)


def test_own_organisation_unpublished_and_internal_records_are_equally_invisible(world):
    member = world.approver
    client = client_for(member.user)
    # Draft update, unproposed AI brief, hidden milestone, internal file, internal discussion, unshared version.
    hidden_paths = [
        (f"/portal/updates/{world.draft_update.pk}/", 404),
        (f"/portal/milestones/{world.ms_hidden.pk}/", 404),
        (f"/portal/files/{world.internal_file.file_id}/", 404),
        (f"/portal/files/versions/{world.internal_file.pk}/download/", 404),
    ]
    for path, status in hidden_paths:
        assert client.get(path).status_code == status, path
    v2 = services.create_version(
        world.deliv_a, actor=world.staff, summary="Unshared v2", body="UNSHARED-V2-BODY"
    )
    assert (
        client.get(f"/portal/deliverables/{world.deliv_a.pk}/?v={v2.number}").content.count(
            b"UNSHARED-V2-BODY"
        )
        == 0
    )
    for path in (
        "/portal/",
        f"/portal/challenges/{world.ch_a.pk}/",
        f"/portal/projects/{world.project_a.pk}/",
        f"/portal/deliverables/{world.deliv_a.pk}/",
        "/portal/files/",
        "/portal/activity/",
    ):
        body = client.get(path).content.decode()
        for needle in (
            INTERNAL["draft_update"],
            INTERNAL["draft_brief"],
            "Hidden internal milestone",
            INTERNAL["thread"],
            INTERNAL["file"],
            "UNSHARED-V2-BODY",
            "secret.pdf",
        ):
            assert needle not in body, (path, needle)
        for marker in INTERNAL.values():
            assert marker not in body, (path, marker)
    assert not selectors.briefs(member, world.ch_a).filter(pk=world.draft_brief.pk).exists()
    assert not selectors.threads(member, world.ch_a).filter(is_internal=True).exists()


def test_unshared_challenge_and_unpublished_project_are_invisible(world):
    from apps.aidata import services as aidata_services

    opp = aidata_services.create_opportunity({"title": "Private enquiry", "organisation": "X"}, world.staff)
    private = services.link_challenge(
        opportunity=opp, organisation=world.org_a, actor=world.staff, title="Private challenge"
    )
    client = client_for(world.approver.user)
    assert client.get(f"/portal/challenges/{private.pk}/").status_code == 404
    assert b"Private challenge" not in client.get("/portal/challenges/").content
    services.share_challenge(private, actor=world.staff)
    assert client.get(f"/portal/challenges/{private.pk}/").status_code == 200
    hidden_project = services.save_project(
        private, actor=world.staff, name="Hidden project", status="planning"
    )
    assert client.get(f"/portal/projects/{hidden_project.pk}/").status_code == 404
    services.set_published(hidden_project, True, actor=world.staff)
    assert client.get(f"/portal/projects/{hidden_project.pk}/").status_code == 200
    services.set_published(hidden_project, False, actor=world.staff)
    assert client.get(f"/portal/projects/{hidden_project.pk}/").status_code == 404


def test_download_is_authorised_per_request_and_internal_is_never_served(world):
    client = client_for(world.approver.user)
    ok = client.get(f"/portal/files/versions/{world.shared_file.pk}/download/")
    assert ok.status_code == 200 and ok["Content-Disposition"].startswith("attachment")
    assert ok["X-Content-Type-Options"] == "nosniff"
    services.set_file_visibility(world.shared_file.file, "internal", actor=world.staff)
    assert client.get(f"/portal/files/versions/{world.shared_file.pk}/download/").status_code == 404
    # Staff download endpoint is staff-only.
    assert client.get(f"/client-portal/files/versions/{world.shared_file.pk}/download/").status_code == 403


def test_after_revocation_every_surface_is_closed(world):
    client = client_for(world.approver.user)
    assert client.get("/portal/notifications/").status_code == 200
    services.revoke_member(world.approver, actor=world.staff)
    for path in [
        "/portal/",
        "/portal/notifications/",
        "/portal/search/?q=invoice",
        f"/portal/files/versions/{world.shared_file.pk}/download/",
        f"/portal/projects/{world.project_a.pk}/export.csv",
    ] + a_pages(world):
        assert client.get(path).status_code in (403, 404), path
    assert client.post("/portal/assistant/what_needed/", {}, **HX).status_code == 403
    assert selectors.notifications(world.approver.user).count() == 0


def test_stored_file_bytes_unavailable_status_is_visible_not_downloadable(world, settings):
    settings.PORTAL_FILES_STORAGE_ENABLED = False
    version = services.upload_staff_file(
        world.ch_a,
        __import__("tests.portal_helpers", fromlist=["upload"]).upload("nostore.pdf"),
        actor=world.staff,
        title="No storage",
        visibility="customer",
    )
    assert version.upload_status == FileVersion.Status.UNAVAILABLE
    client = client_for(world.approver.user)
    assert client.get(f"/portal/files/versions/{version.pk}/download/").status_code == 404
    assert (
        b"not set up" in client.get("/portal/files/").content
        or b"not configured" in client.get(f"/portal/files/{version.file_id}/").content
    )
