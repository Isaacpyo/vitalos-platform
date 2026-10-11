from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import (
    KPI,
    Company,
    Decision,
    KPIValue,
    Offer,
    Practice,
    Project,
    ServiceLine,
    Solution,
    TeamMember,
)

GOVERNANCE_FIELDS = ("created_at", "created_by", "updated_at", "updated_by", "is_archived", "archived_at")


class GovernedAdmin(SimpleHistoryAdmin):
    """Hard delete lives here only; the application UI archives and restores."""

    readonly_fields = GOVERNANCE_FIELDS
    list_filter = ("is_archived", "classification")


@admin.register(Company)
class CompanyAdmin(GovernedAdmin):
    list_display = ("name", "tagline", "updated_at")


@admin.register(ServiceLine)
class ServiceLineAdmin(GovernedAdmin):
    list_display = ("name", "slug", "order", "is_active", "owner", "is_archived")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Practice)
class PracticeAdmin(GovernedAdmin):
    list_display = ("name", "service_line", "status", "maturity", "is_archived")
    list_filter = ("service_line", "status", "is_archived")
    search_fields = ("name", "summary")


@admin.register(Solution)
class SolutionAdmin(GovernedAdmin):
    list_display = ("name", "practice", "status", "maturity", "is_archived")
    search_fields = ("name", "summary")


@admin.register(Offer)
class OfferAdmin(GovernedAdmin):
    list_display = ("name", "solution", "status", "maturity", "is_archived")
    search_fields = ("name", "summary")


@admin.register(TeamMember)
class TeamMemberAdmin(GovernedAdmin):
    list_display = ("name", "role_title", "email", "user", "is_archived")
    search_fields = ("name", "email")


@admin.register(Project)
class ProjectAdmin(GovernedAdmin):
    list_display = ("name", "client", "service_line", "status", "start_date", "is_archived")
    list_filter = ("service_line", "status", "is_archived", "classification")
    search_fields = ("name", "client")


class KPIValueInline(admin.TabularInline):
    model = KPIValue
    extra = 0
    fields = ("date", "value", "classification")


@admin.register(KPI)
class KPIAdmin(GovernedAdmin):
    list_display = ("name", "service_line", "unit", "target", "direction", "is_headline")
    inlines = [KPIValueInline]


@admin.register(KPIValue)
class KPIValueAdmin(GovernedAdmin):
    list_display = ("kpi", "date", "value", "is_archived")
    list_filter = ("kpi__service_line", "is_archived")


@admin.register(Decision)
class DecisionAdmin(GovernedAdmin):
    list_display = ("title", "date", "service_line", "is_archived")
    search_fields = ("title", "rationale")
