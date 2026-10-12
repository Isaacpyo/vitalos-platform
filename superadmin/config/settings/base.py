"""Settings shared by every environment. Secrets and hosts come only from the environment."""

from datetime import timedelta
from pathlib import Path

import environ
from csp.constants import NONCE, NONE, SELF

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
if (BASE_DIR / ".env").is_file():
    environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="")
DEBUG = False
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
APP_ENVIRONMENT = env("APP_ENVIRONMENT", default="development")

INSTALLED_APPS = [
    "apps.core.apps.SuperAdminSiteConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "django.contrib.postgres",
    "django_htmx",
    "simple_history",
    "axes",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "csp",
    "rest_framework",
    "drf_spectacular",
    "drf_spectacular_sidecar",
    "apps.core",
    "apps.audit",
    "apps.mailer",
    "apps.accounts",
    "apps.notifications",
    "apps.architecture",
    "apps.api",
]

MIDDLEWARE = [
    "apps.core.middleware.HealthCheckMiddleware",
    "apps.core.middleware.RequestIDMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "apps.core.middleware.SecurityHeadersMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "apps.accounts.middleware.OTPEnforcementMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "csp.middleware.CSPMiddleware",
    "django_htmx.middleware.HtmxMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
    "axes.middleware.AxesMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.core.context_processors.app_context",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "architecture:home"
LOGOUT_REDIRECT_URL = "accounts:login"

# Sessions: 8 hour absolute lifetime, HTTP-only cookies.
SESSION_COOKIE_AGE = 8 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_NAME = "vsa_session"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_NAME = "vsa_csrftoken"

# django-axes: lock an email+IP combination after repeated failures.
AXES_FAILURE_LIMIT = env.int("AXES_FAILURE_LIMIT", default=5)
AXES_COOLOFF_TIME = timedelta(minutes=env.int("AXES_COOLOFF_MINUTES", default=30))
AXES_LOCKOUT_PARAMETERS = [["username", "ip_address"]]
AXES_USERNAME_FORM_FIELD = "email"
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_TEMPLATE = "accounts/lockout.html"
AXES_CLIENT_IP_CALLABLE = "apps.core.http.client_ip"
AXES_SENSITIVE_PARAMETERS = ["password"]
# Number of trusted reverse proxies in front of the app (Azure Container Apps ingress = 1).
TRUSTED_PROXY_COUNT = env.int("TRUSTED_PROXY_COUNT", default=0)

# django-otp: TOTP is mandatory for SuperAdmin and for anyone who enrolled a device.
# REQUIRE_MFA_FOR_SUPER_ADMIN is accepted as an alias for OTP_REQUIRED_FOR_SUPERADMIN.
OTP_TOTP_ISSUER = "Vitalos Super Admin"
OTP_REQUIRED_FOR_SUPERADMIN = env.bool(
    "OTP_REQUIRED_FOR_SUPERADMIN", default=env.bool("REQUIRE_MFA_FOR_SUPER_ADMIN", default=True)
)

# Primary owner and sign-in. The owner is created by `manage.py create_owner` with no password.
APP_BASE_URL = env("APP_BASE_URL", default="http://localhost:8000").rstrip("/")
PRIMARY_OWNER_EMAIL = env("PRIMARY_OWNER_EMAIL", default="").strip().lower()
# Pre-fills the sign-in email when set. Empty by default: pre-filling a public page reveals the login.
DEFAULT_SIGNIN_EMAIL = env("DEFAULT_SIGNIN_EMAIL", default="").strip().lower()

# Outbound email. EMAIL_TRANSPORT=log (default) never sends; resend is switched on by a human only.
EMAIL_TRANSPORT = env("EMAIL_TRANSPORT", default="log")
EMAIL_BACKEND = {
    "log": "apps.mailer.backends.LogEmailBackend",
    "resend": "apps.mailer.backends.ResendEmailBackend",
}.get(EMAIL_TRANSPORT, "apps.mailer.backends.LogEmailBackend")
RESEND_API_KEY = env("RESEND_API_KEY", default="")
RESEND_API_URL = "https://api.resend.com/emails"
NOTIFY_FROM = env("NOTIFY_FROM", default="notifications@vitalos.co.uk")
NOTIFY_FROM_HEADER = f"Vitalos Admin <{NOTIFY_FROM}>"
DEFAULT_FROM_EMAIL = NOTIFY_FROM_HEADER
SERVER_EMAIL = NOTIFY_FROM_HEADER
SUPPORT_MAILBOX = env("SUPPORT_MAILBOX", default="support@vitalos.co.uk")
SUPPORT_FROM_HEADER = f"Vitalos Support <{SUPPORT_MAILBOX}>"
NOTIFY_OWNER_EMAIL = env("NOTIFY_OWNER_EMAIL", default=PRIMARY_OWNER_EMAIL or "admin@vitalos.co.uk")
# Forgot-password emails only make sense when mail can actually be delivered (or locally).
PASSWORD_RESET_ENABLED = env.bool(
    "PASSWORD_RESET_ENABLED", default=EMAIL_TRANSPORT != "log" or APP_ENVIRONMENT == "development"
)

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Europe/London"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
CSV_IMPORT_MAX_BYTES = 2 * 1024 * 1024

# Security headers that are safe in every environment.
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# Strict CSP: no inline script or style without the per-request nonce.
CONTENT_SECURITY_POLICY = {
    "DIRECTIVES": {
        "default-src": [NONE],
        "script-src": [SELF, NONCE],
        "style-src": [SELF, NONCE],
        "img-src": [SELF, "data:"],
        "font-src": [SELF],
        "connect-src": [SELF],
        "manifest-src": [SELF],
        "form-action": [SELF],
        "frame-ancestors": [NONE],
        "base-uri": [NONE],
        "object-src": [NONE],
    },
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.api.authentication.ApiTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["apps.api.permissions.HasAnyRole"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.UserRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"user": "600/hour"},
}
SPECTACULAR_SETTINGS = {
    "TITLE": "Vitalos Super Admin API",
    "DESCRIPTION": "Read-only API over the Vitalos company architecture. "
    "Authenticate with `Authorization: Bearer <token>` using a token from Settings → API tokens.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PERMISSIONS": ["apps.api.permissions.HasAnyRole"],
    "SWAGGER_UI_DIST": "SIDECAR",
    "SWAGGER_UI_FAVICON_HREF": "SIDECAR",
    "REDOC_DIST": "SIDECAR",
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "OfferingStatusEnum": "apps.architecture.models.OfferingStatus",
        "ProjectStatusEnum": "apps.architecture.models.Project.Status",
    },
}

SIMPLE_HISTORY_REVERT_DISABLED = True
SIMPLE_HISTORY_HISTORY_CHANGE_REASON_USE_TEXT_FIELD = True

# Logging: JSON lines with request IDs by default; LOG_FORMAT=text for local readability.
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOG_FORMAT = env("LOG_FORMAT", default="json")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_id": {"()": "apps.core.logging.RequestIDFilter"}},
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.json.JsonFormatter",
            "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s",
            "rename_fields": {"asctime": "timestamp", "levelname": "level", "name": "logger"},
        },
        "text": {"format": "%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": LOG_FORMAT if LOG_FORMAT in ("json", "text") else "json",
            "filters": ["request_id"],
        }
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
        "django.server": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "axes": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}

SENTRY_DSN = env("SENTRY_DSN", default="")
