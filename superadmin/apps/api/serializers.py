from rest_framework import serializers

from apps.architecture.models import (
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

GOVERNANCE = ["classification", "is_archived", "archived_at", "created_at", "updated_at"]


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["name", "tagline", "vision", "mission", "business_modes", *GOVERNANCE]


class ServiceLineSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True, allow_null=True, default=None)

    class Meta:
        model = ServiceLine
        fields = [
            "id",
            "name",
            "slug",
            "tagline",
            "business_modes",
            "colour",
            "icon",
            "order",
            "is_active",
            "owner_email",
            *GOVERNANCE,
        ]


OFFERING = ["id", "name", "slug", "summary", "status", "maturity", "order", *GOVERNANCE]


class PracticeSerializer(serializers.ModelSerializer):
    service_line = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta:
        model = Practice
        fields = ["service_line", *OFFERING]


class SolutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Solution
        fields = ["practice", *OFFERING]


class OfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offer
        fields = ["solution", *OFFERING]


class TeamMemberSerializer(serializers.ModelSerializer):
    service_lines = serializers.SlugRelatedField(slug_field="slug", many=True, read_only=True)

    class Meta:
        model = TeamMember
        fields = ["id", "name", "role_title", "email", "service_lines", *GOVERNANCE]


class ProjectSerializer(serializers.ModelSerializer):
    service_line = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "client",
            "service_line",
            "status",
            "start_date",
            "end_date",
            "lead",
            "value",
            *GOVERNANCE,
        ]


class KPISerializer(serializers.ModelSerializer):
    service_line = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta:
        model = KPI
        fields = ["id", "service_line", "name", "unit", "target", "direction", "is_headline", *GOVERNANCE]


class KPIValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = KPIValue
        fields = ["id", "kpi", "date", "value", *GOVERNANCE]


class DecisionSerializer(serializers.ModelSerializer):
    service_line = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)

    class Meta:
        model = Decision
        fields = ["id", "title", "rationale", "date", "service_line", "notion_url", *GOVERNANCE]
