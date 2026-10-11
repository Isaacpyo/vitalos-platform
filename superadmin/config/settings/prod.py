"""Production: every secret and host comes from the environment; fail closed if missing."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import SENTRY_DSN, env

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY")
if len(SECRET_KEY) < 50:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be at least 50 characters.")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")
DATABASES = {"default": env.db("DATABASE_URL")}
# Neon (free tier) autosuspends after 5 idle minutes and is reached through its PgBouncer pooler:
# open a fresh connection per request, health-check reused ones, and avoid server-side cursors,
# which transaction pooling does not support.
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=0)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = env.bool("DB_DISABLE_SERVER_SIDE_CURSORS", default=True)
APP_ENVIRONMENT = env("APP_ENVIRONMENT", default="production")

# TLS terminates at the platform ingress, which sets X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_REDIRECT_EXEMPT = [r"^healthz/$"]
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = False
# Preload-list submission is a decision for the whole vitalos.co.uk apex, not this subdomain
# (see docs/DECISIONS.md), so its deploy-check warning is acknowledged here.
SILENCED_SYSTEM_CHECKS = ["security.W021"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
TRUSTED_PROXY_COUNT = env.int("TRUSTED_PROXY_COUNT", default=1)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        environment=APP_ENVIRONMENT,
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0),
        send_default_pii=False,
    )
