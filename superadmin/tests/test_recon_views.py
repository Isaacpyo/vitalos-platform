"""Demonstrator pages and services: access, POST + CSRF, escaping, audit, idempotency, retry and
recovery, review decisions, settings, kill switch and metering."""

from decimal import Decimal

import pytest
from django.test import Client
from django.urls import reverse

from apps.aicore import services as aicore
from apps.aicore.models import AiSettings, ModelExecution
from apps.audit.models import AuditEvent
from apps.recon_demo.models import ReconRun, ReviewItem

from .conftest import login

INDEX = reverse("recon_demo:index")
NEW = reverse("recon_demo:new")
LEDGER = "date,reference,type,amount\n2026-09-03,INV-1,invoice,100.00\n"
STATEMENT = "Date,Reference,Type,Amount\n2026-09-03,INV-1,Invoice,100.00\n"


def start(client, **data):
    payload = {"source": "sample", "mode": "off", "synthetic_confirmed": "on", **data}
    return client.post(NEW, payload)


@pytest.fixture
def admin_client(superadmin, client_for):
    return client_for(superadmin)


def latest():
    return ReconRun.objects.order_by("-number").first()


# --- access ------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_anonymous_users_are_sent_to_sign_in(client):
    for url in (INDEX, NEW, reverse("recon_demo:evaluation"), reverse("recon_demo:settings")):
        response = client.get(url)
        assert response.status_code == 302 and "/login/" in response["Location"]


@pytest.mark.django_db
def test_users_without_an_ai_data_role_get_403(client_for, norole, viewer):
    for user in (norole, viewer):
        client = client_for(user)
        assert client.get(INDEX).status_code == 403
        assert start(client, sample_key="clean-csv").status_code == 403
    assert ReconRun.objects.count() == 0


@pytest.mark.django_db
def test_service_lead_can_run_but_not_change_settings(client_for, lead):
    client = client_for(lead)
    assert client.get(INDEX).status_code == 200
    response = start(client, sample_key="clean-csv")
    assert response.status_code == 302 and latest().state == "COMPLETED"
    assert client.get(reverse("recon_demo:settings")).status_code == 403


@pytest.mark.django_db
def test_state_changing_endpoints_are_post_only(admin_client):
    start(admin_client, sample_key="provider-failure", mode="simulated")
    run = latest()
    for name in ("retry", "continue", "run_again"):
        assert admin_client.get(reverse(f"recon_demo:{name}", args=[run.ref])).status_code == 405


@pytest.mark.django_db
def test_posts_need_a_csrf_token(superadmin):
    client = login(Client(enforce_csrf_checks=True), superadmin)
    assert start(client, sample_key="clean-csv").status_code == 403
    assert ReconRun.objects.count() == 0


# --- runs --------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_statement_text_is_escaped(admin_client):
    evil = STATEMENT + "<script>alert('x')</script> 12.00\n"
    start(admin_client, source="paste", statement=evil, ledger=LEDGER)
    run = latest()
    page = admin_client.get(run.get_absolute_url()).content.decode()
    assert "<script>alert(" not in page
    assert "&lt;script&gt;alert(" in page


@pytest.mark.django_db
def test_synthetic_confirmation_is_required(admin_client):
    response = admin_client.post(NEW, {"source": "sample", "sample_key": "clean-csv", "mode": "off"})
    assert response.status_code == 200 and b"synthetic or explicitly authorised" in response.content
    assert ReconRun.objects.count() == 0


@pytest.mark.django_db
def test_completed_run_is_recorded_and_audited(admin_client):
    response = start(admin_client, sample_key="clean-csv")
    run = latest()
    assert response["Location"] == run.get_absolute_url()
    assert run.ref == "RUN-0001" and run.state == "COMPLETED" and run.cost_gbp == 0 and run.model_calls == 0
    assert run.config_versions["parser"] == "statement_rules@1" and run.synthetic_data_confirmed
    assert [step["state"] for step in run.timeline] == ["CREATED", "RUNNING", "COMPLETED"]
    event = AuditEvent.objects.get(action="recon_demo.run_created")
    assert event.entity_id == str(run.pk) and event.metadata["state"] == "COMPLETED"
    page = admin_client.get(run.get_absolute_url())
    assert page.status_code == 200 and b"Fully reconciled" in page.content


@pytest.mark.django_db
def test_identical_input_returns_the_existing_run_unless_run_again(admin_client):
    start(admin_client, sample_key="clean-csv")
    response = start(admin_client, sample_key="clean-csv")
    assert ReconRun.objects.count() == 1 and response["Location"] == latest().get_absolute_url()
    admin_client.post(reverse("recon_demo:run_again", args=[latest().ref]))
    assert ReconRun.objects.count() == 2
    start(admin_client, sample_key="clean-csv", run_again="True")
    assert ReconRun.objects.count() == 3


@pytest.mark.django_db
def test_exceptions_create_review_items_and_decisions_are_audited(admin_client):
    start(admin_client, sample_key="missing-mismatch")
    run = latest()
    assert run.state == "REVIEW_REQUIRED"
    items = list(run.review_items.all())
    assert {item.kind for item in items} == {"exception"} and len(items) == 3
    url = reverse("recon_demo:decide", args=[run.ref, items[0].pk])
    admin_client.post(url, {"decision": "accept", "note": "Credit requested"})
    admin_client.post(
        reverse("recon_demo:decide", args=[run.ref, items[1].pk]),
        {
            "decision": "correct",
            "date": "06/10/2026",
            "reference": "INV-3102",
            "type": "invoice",
            "amount": "1,404.00",
        },
    )
    admin_client.post(
        reverse("recon_demo:decide", args=[run.ref, items[2].pk]), {"decision": "correct", "amount": "x"}
    )
    items = list(run.review_items.all())
    assert (
        items[0].status == "accepted"
        and items[0].note == "Credit requested"
        and items[0].reviewer is not None
    )
    assert items[1].status == "corrected" and items[1].correction == {
        "date": "2026-10-06",
        "reference": "INV-3102",
        "type": "invoice",
        "amount": "1404.00",
    }
    assert items[2].status == "open"  # invalid correction refused
    assert AuditEvent.objects.filter(action="recon_demo.review_decided").count() == 2


@pytest.mark.django_db
def test_injection_sample_is_flagged(admin_client):
    start(admin_client, sample_key="injection")
    run = latest()
    assert run.state == "REVIEW_REQUIRED"
    assert "instruction_like_text" in set(run.review_items.values_list("kind", flat=True))
    assert any(r["code"] == "instruction_like_text" for r in run.reasons)


@pytest.mark.django_db
def test_simulated_model_path_is_metered_and_labelled(admin_client):
    start(admin_client, sample_key="unparsed-layout", mode="simulated")
    run = latest()
    assert (
        run.state == "COMPLETED" and run.simulated and run.model_mode == "simulated" and run.model_calls == 1
    )
    execution = ModelExecution.objects.get(run_ref=run.ref)
    assert (
        execution.simulated
        and execution.outcome == "success"
        and execution.prompt_id == "statement_extraction"
    )
    assert execution.prompt_version == 2 and len(execution.prompt_hash) == 64 and execution.cost_gbp == 0
    page = admin_client.get(run.get_absolute_url()).content.decode()
    assert 'data-testid="simulated-badge"' in page and "model, grounded" in page


@pytest.mark.django_db
def test_rules_only_unparsed_layout_needs_manual_extraction(admin_client):
    start(admin_client, sample_key="unparsed-layout", mode="off")
    run = latest()
    assert run.state == "REVIEW_REQUIRED" and run.model_calls == 0
    assert set(run.review_items.values_list("kind", flat=True)) == {"manual_extraction"}


@pytest.mark.django_db
def test_provider_failure_then_retry_recovers(admin_client):
    start(admin_client, sample_key="provider-failure", mode="simulated")
    run = latest()
    assert run.state == "FAILED" and run.error_category == "unavailable" and run.model_calls == 3
    assert run.review_items.count() == 0 and run.results["lines"] == []
    page = admin_client.get(run.get_absolute_url()).content.decode()
    assert "simulated failure" in page and 'data-testid="retry"' in page
    admin_client.post(reverse("recon_demo:retry", args=[run.ref]))
    run.refresh_from_db()
    assert run.state == "COMPLETED" and run.retries == 1 and run.model_calls == 4
    assert [s["state"] for s in run.timeline][-1] == "COMPLETED" and "FAILED" in [
        s["state"] for s in run.timeline
    ]
    assert AuditEvent.objects.filter(action="recon_demo.run_retried").exists()
    assert ModelExecution.objects.filter(run_ref=run.ref).count() == 2


@pytest.mark.django_db
def test_continue_without_model_routes_lines_to_review(admin_client):
    start(admin_client, sample_key="provider-failure", mode="simulated")
    run = latest()
    admin_client.post(reverse("recon_demo:continue", args=[run.ref]))
    run.refresh_from_db()
    assert run.state == "REVIEW_REQUIRED"
    assert set(run.review_items.values_list("kind", flat=True)) == {"manual_extraction"}
    assert AuditEvent.objects.filter(action="recon_demo.run_continued").exists()
    # A run that is not FAILED cannot be retried.
    admin_client.post(reverse("recon_demo:retry", args=[run.ref]))
    run.refresh_from_db()
    assert run.state == "REVIEW_REQUIRED" and run.retries == 0


@pytest.mark.django_db
def test_unsupported_input_is_stored_safely(admin_client):
    start(admin_client, source="paste", statement="", ledger=LEDGER)
    assert latest().state == "UNSUPPORTED" and "empty" in latest().results["unsupported_reason"]
    start(admin_client, source="paste", statement="x" * 70_000, ledger=LEDGER)
    run = latest()
    assert run.state == "UNSUPPORTED" and run.input_truncated and len(run.statement_text) == 64 * 1024
    start(admin_client, source="paste", statement=STATEMENT + "\x00", ledger=LEDGER)
    assert latest().state == "UNSUPPORTED" and "\x00" not in latest().statement_text


# --- controls ----------------------------------------------------------------------------------


@pytest.mark.django_db
def test_kill_switch_blocks_new_runs(admin_client):
    ai = AiSettings.load()
    ai.enabled = False
    ai.save()
    response = start(admin_client, sample_key="clean-csv")
    assert response.status_code == 200 and b"kill switch" in response.content
    assert ReconRun.objects.count() == 0


@pytest.mark.django_db
def test_environment_kill_switch_overrides_the_database(admin_client, settings):
    settings.AI_DATA_DISABLED = True
    assert AiSettings.load().enabled and not aicore.is_enabled()
    start(admin_client, sample_key="clean-csv")
    assert ReconRun.objects.count() == 0


@pytest.mark.django_db
def test_live_mode_without_a_key_falls_back_to_review(admin_client):
    ai = AiSettings.load()
    ai.model_path_enabled = True
    ai.save()
    start(admin_client, sample_key="unparsed-layout", mode="live")
    run = latest()
    assert run.model_mode == "off" and run.model_calls == 0 and run.state == "REVIEW_REQUIRED"
    assert "AI_DATA_LLM_API_KEY" in run.timeline[0]["note"]


@pytest.mark.django_db
def test_db_usage_counts_spend_and_live_runs(admin_client):
    def execution(run_ref, cost, simulated=False):
        ModelExecution.objects.create(
            execution_id=f"00000000-0000-4000-8000-{ModelExecution.objects.count():012d}",
            workflow="w",
            run_ref=run_ref,
            prompt_id="p",
            prompt_version=1,
            prompt_hash="h",
            provider="x",
            model="m",
            outcome="success",
            attempts=1,
            cost_gbp=Decimal(cost),
            simulated=simulated,
        )

    execution("RUN-1", "0.25")
    execution("RUN-1", "0.25")
    execution("RUN-2", "0.10")
    execution("RUN-3", "0", simulated=True)
    usage = aicore.DbUsage()
    assert usage.spent_this_month_gbp() == Decimal("0.60") and usage.model_runs_today() == 2


@pytest.mark.django_db
def test_settings_are_superadmin_only_and_audited(admin_client):
    url = reverse("recon_demo:settings")
    page = admin_client.get(url)
    assert page.status_code == 200 and b"AI_DATA_LLM_API_KEY" in page.content
    response = admin_client.post(
        url,
        {
            "enabled": "on",
            "model_path_enabled": "on",
            "daily_run_cap": "5",
            "monthly_budget_gbp": "2.50",
            "max_calls_per_run": "3",
        },
    )
    assert response.status_code == 302
    ai = AiSettings.load()
    assert ai.model_path_enabled and ai.daily_run_cap == 5 and ai.monthly_budget_gbp == Decimal("2.50")
    event = AuditEvent.objects.get(action="aicore.settings_changed")
    assert set(event.metadata["after"]) == {
        "model_path_enabled",
        "daily_run_cap",
        "monthly_budget_gbp",
        "max_calls_per_run",
    }
    assert aicore.limits().daily_run_cap == 5


@pytest.mark.django_db
def test_settings_page_never_shows_the_key(admin_client, settings):
    settings.AI_DATA_LLM_API_KEY = "sk-secret-NEVER-RENDER-123456"
    settings.AI_DATA_LLM_BASE_URL = "https://api.example.test/v1"
    settings.AI_DATA_LLM_MODEL = "gpt-4o-mini"
    page = admin_client.get(reverse("recon_demo:settings")).content.decode()
    assert "sk-secret-NEVER-RENDER" not in page and "The API key is set" in page


@pytest.mark.django_db
def test_pages_render(admin_client):
    start(admin_client, sample_key="duplicate")
    for url in (
        INDEX,
        NEW,
        NEW + "?sample=injection",
        reverse("recon_demo:evaluation"),
        latest().get_absolute_url(),
    ):
        assert admin_client.get(url).status_code == 200
    assert admin_client.get(reverse("recon_demo:detail", args=["RUN-9999"])).status_code == 404
    assert admin_client.get(reverse("recon_demo:detail", args=["nope"])).status_code == 404


@pytest.mark.django_db
def test_review_decisions_only_on_runs_awaiting_review(admin_client):
    start(admin_client, sample_key="clean-csv")
    run = latest()
    item = ReviewItem.objects.create(run=run, position=1, kind="exception", detail="x")
    admin_client.post(reverse("recon_demo:decide", args=[run.ref, item.pk]), {"decision": "accept"})
    item.refresh_from_db()
    assert item.status == "open"
