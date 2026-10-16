from django.urls import path

from . import views

app_name = "insights"

urlpatterns = [
    path("", views.root, name="root"),
    path("posts/", views.post_list, name="posts"),
    path("posts/new/", views.post_new, name="post_new"),
    path("posts/bulk/", views.post_bulk, name="post_bulk"),
    path("posts/<uuid:pk>/", views.post_edit, name="post"),
    path("posts/<uuid:pk>/autosave/", views.post_autosave, name="post_autosave"),
    path("posts/<uuid:pk>/rail/", views.post_rail, name="post_rail"),
    path("posts/<uuid:pk>/sync/", views.post_sync, name="post_sync"),
    path("posts/<uuid:pk>/actions/<slug:action>/", views.post_action, name="post_action"),
    path("posts/<uuid:pk>/checks/<slug:key>/", views.post_check, name="post_check"),
    path("posts/<uuid:pk>/cover/", views.post_cover, name="post_cover"),
    path("posts/<uuid:pk>/preview/", views.post_preview_panel, name="post_preview_panel"),
    path("posts/<uuid:pk>/preview/frame/", views.post_preview_frame, name="post_preview_frame"),
    path("posts/<uuid:pk>/preview/site/", views.post_site_preview, name="post_site_preview"),
    path("posts/<uuid:pk>/revisions/<int:revision_id>/", views.revision_view, name="revision"),
    path(
        "posts/<uuid:pk>/revisions/<int:revision_id>/restore/",
        views.revision_restore,
        name="revision_restore",
    ),
    path("media/", views.media_upload, name="media_upload"),
    path("authors/", views.author_list, name="authors"),
    path("authors/new/", views.author_new, name="author_new"),
    path("authors/<uuid:pk>/", views.author_edit, name="author"),
    path("authors/<uuid:pk>/<slug:action>/", views.author_action, name="author_action"),
    path("topics/", views.topic_list, name="topics"),
    path("topics/<uuid:pk>/", views.topic_edit, name="topic"),
    path("topics/<uuid:pk>/<slug:action>/", views.topic_action, name="topic_action"),
    path("settings/", views.settings_page, name="settings"),
    path("settings/preview/", views.settings_preview, name="settings_preview"),
]
