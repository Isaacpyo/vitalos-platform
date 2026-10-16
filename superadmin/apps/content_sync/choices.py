"""Enumerations shared by Insights and Careers, with the public labels the read API sends."""

from django.db import models


class Practice(models.TextChoices):
    CONSULTING = "consulting", "Consulting"
    ENGINEERING = "engineering", "Engineering"
    AI_DATA = "ai_data", "AI & Data"
    EXPERIENCE = "experience", "Experience"
    MANAGED_SERVICES = "managed_services", "Managed Services"
    LABS = "labs", "Labs"


PRACTICE_ORDER = [choice.value for choice in Practice]


class Entity(models.TextChoices):
    """What a sync event is about (brief 3.4, plus ``site`` for open, close and resync)."""

    POST = "post", "Post"
    AUTHOR = "author", "Author"
    TOPIC = "topic", "Topic"
    ROLE = "role", "Role"
    CAREERS_SETTINGS = "careers_settings", "Careers settings"
    HOME_SECTION = "home_section", "Homepage section"
    SITE = "site", "Site"


class RedirectEntity(models.TextChoices):
    POST = "post", "Post"
    AUTHOR = "author", "Author"
    ROLE = "role", "Role"
