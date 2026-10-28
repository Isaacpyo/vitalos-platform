import pytest

from tests.portal_helpers import build_world, client_for


@pytest.mark.django_db
def test_world_builds_and_customer_pages_render(settings):
    w = build_world()
    client = client_for(w.approver.user)
    for url in [
        "/portal/",
        "/portal/challenges/",
        f"/portal/challenges/{w.ch_a.pk}/",
        f"/portal/projects/{w.project_a.pk}/",
        f"/portal/deliverables/{w.deliv_a.pk}/",
        "/portal/questions/",
        f"/portal/questions/{w.q_a.pk}/",
        "/portal/files/",
        "/portal/notifications/",
        "/portal/account/",
        f"/portal/updates/{w.upd_a.pk}/",
        f"/portal/milestones/{w.ms2.pk}/",
        "/portal/activity/",
        "/portal/search/?q=invoice",
    ]:
        response = client.get(url)
        assert response.status_code == 200, (url, response.status_code)
