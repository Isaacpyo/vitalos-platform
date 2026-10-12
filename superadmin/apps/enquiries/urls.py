from django.urls import path, re_path

from . import views

app_name = "enquiries"

REF = r"(?P<ref>VIT-\d{4,})"

urlpatterns = [
    path("", views.inbox, name="inbox"),
    path("badge/", views.badge, name="badge"),
    re_path(rf"^{REF}/$", views.detail, name="detail"),
]
