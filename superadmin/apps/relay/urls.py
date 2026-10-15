from django.urls import path, re_path

from .views import inbox, knowledge, me, pages

app_name = "relay"

UUID = r"(?P<conversation_id>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"

urlpatterns = [
    path("", inbox.index, name="index"),
    path("inbox/", inbox.inbox, name="inbox"),
    # Email deep links are /relay/inbox/<id>?ref=email (API.md), so the trailing slash is optional.
    re_path(rf"^inbox/{UUID}/?$", inbox.thread, name="thread"),
    path("inbox/<uuid:conversation_id>/messages/", inbox.messages_after, name="messages"),
    path("inbox/<uuid:conversation_id>/context/", inbox.context_panel, name="context"),
    path("inbox/<uuid:conversation_id>/join/", inbox.join, name="join"),
    path("inbox/<uuid:conversation_id>/assign/", inbox.assign, name="assign"),
    path("inbox/<uuid:conversation_id>/handback/", inbox.hand_back, name="handback"),
    path("inbox/<uuid:conversation_id>/close/", inbox.close, name="close"),
    path("inbox/<uuid:conversation_id>/reply/", inbox.reply, name="reply"),
    path("inbox/<uuid:conversation_id>/note/", inbox.note, name="note"),
    path("inbox/<uuid:conversation_id>/typing/", inbox.typing, name="typing"),
    path("inbox/<uuid:conversation_id>/delete/", inbox.delete, name="delete"),
    path(
        "inbox/<uuid:conversation_id>/save-to-knowledge/", inbox.save_to_knowledge, name="save_to_knowledge"
    ),
    path("inbox/<uuid:conversation_id>/transcript/", inbox.transcript, name="transcript"),
    path("knowledge/", knowledge.knowledge, name="knowledge"),
    path("knowledge/new/", knowledge.knowledge_new, name="knowledge_new"),
    path("knowledge/test/", knowledge.test_retrieval, name="knowledge_test"),
    path("knowledge/preview/", knowledge.preview, name="knowledge_preview"),
    path("knowledge/reindex-all/", knowledge.reindex_all, name="reindex_all"),
    path("knowledge/faq/sync/", knowledge.faq_sync, name="faq_sync"),
    path("knowledge/<uuid:document_id>/", knowledge.knowledge_edit, name="knowledge_edit"),
    path("knowledge/<uuid:document_id>/publish/", knowledge.knowledge_publish, name="knowledge_publish"),
    path("knowledge/<uuid:document_id>/archive/", knowledge.knowledge_archive, name="knowledge_archive"),
    path("knowledge/<uuid:document_id>/reindex/", knowledge.knowledge_reindex, name="knowledge_reindex"),
    path("insights/", pages.insights, name="insights"),
    path("settings/", pages.relay_settings, name="settings"),
    path("notifications/", me.notifications, name="notifications"),
    path("notifications/<int:pk>/open/", me.open_notification, name="notification_open"),
    path("notifications/read-all/", me.read_all, name="notifications_read_all"),
    path("bell/", me.bell, name="bell"),
    path("badge/", me.badge, name="badge"),
    path("pulse/", me.pulse, name="pulse"),
    path("me/availability", me.availability, name="availability"),
    path("me/prefs/", me.prefs, name="prefs"),
]
