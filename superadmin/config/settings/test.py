"""Test settings: fast hashing, isolated database (SQLite unless DATABASE_URL is set)."""

from django.core.management.utils import get_random_secret_key

from .base import *  # noqa: F403
from .base import BASE_DIR, LOGGING, MIDDLEWARE, env

SECRET_KEY = get_random_secret_key()
DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost"]
DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'test.sqlite3'}")}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
LOGGING["handlers"]["console"]["formatter"] = "text"
LOGGING["root"]["level"] = "WARNING"
LOGGING["loggers"]["django"]["level"] = "ERROR"
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405
# Static files are served by Django's test client finders; WhiteNoise needs a collected STATIC_ROOT.
MIDDLEWARE = [entry for entry in MIDDLEWARE if "whitenoise" not in entry]
