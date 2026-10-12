from django.urls import path, re_path

from . import views

app_name = "enquiries"

REF = r"(?P<ref>VIT-\d{4,})"

urlpatterns = [
    path("", views.inbox, name="inbox"),
    path("badge/", views.badge, name="badge"),
    path("messages/<int:pk>/body/", views.message_body, name="message_body"),
    path("attachments/<int:pk>/", views.attachment_download, name="attachment"),
    re_path(rf"^{REF}/$", views.detail, name="detail"),
    re_path(rf"^{REF}/status/$", views.set_status, name="status"),
    re_path(rf"^{REF}/priority/$", views.set_priority, name="priority"),
    re_path(rf"^{REF}/assign/$", views.assign, name="assign"),
    re_path(rf"^{REF}/tags/$", views.set_tags, name="tags"),
    re_path(rf"^{REF}/unread/$", views.mark_unread, name="unread"),
    re_path(rf"^{REF}/reply/$", views.reply, name="reply"),
    re_path(rf"^{REF}/note/$", views.add_note, name="note"),
    re_path(rf"^{REF}/export/$", views.export, name="export"),
]
