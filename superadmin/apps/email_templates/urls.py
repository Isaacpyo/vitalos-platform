from django.urls import path

from . import views

app_name = "email_templates"

urlpatterns = [
    path("templates/", views.template_list, name="list"),
    path("templates/new/", views.template_edit, name="create"),
    path("templates/new/preview/", views.template_preview, name="preview_new"),
    path("templates/frame/<slug:slot>/", views.preview_frame, name="frame"),
    path("templates/<int:pk>/", views.template_edit, name="edit"),
    path("templates/<int:pk>/preview/", views.template_preview, name="preview"),
    path("templates/<int:pk>/versions/", views.template_versions, name="versions"),
    path("templates/<int:pk>/versions/<int:number>/restore/", views.version_restore, name="restore"),
    path("templates/<int:pk>/duplicate/", views.template_duplicate, name="duplicate"),
    path("templates/<int:pk>/use/", views.template_use, name="use"),
    path("templates/<int:pk>/use/preview/", views.use_preview, name="use_preview"),
    path("templates/<int:pk>/use/prefill/", views.use_prefill, name="use_prefill"),
    path("templates/<int:pk>/use/frame/", views.use_frame, name="use_frame"),
    path("templates/<int:pk>/use/payload/", views.use_payload, name="use_payload"),
    path("templates/<int:pk>/use/eml/", views.use_eml, name="use_eml"),
    path("templates/<int:pk>/archive/", views.template_archive, name="archive"),
    path("templates/<int:pk>/send-test/", views.template_send_test, name="send_test"),
    path("unsubscribe/<str:token>/", views.unsubscribe, name="unsubscribe"),
]
