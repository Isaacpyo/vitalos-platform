"""Relay thread labels: the closed line carries the visitor's review of the conversation."""

from apps.relay import presenters


def closed(feedback=None):
    return {
        "senderType": "system",
        "body": "closed",
        "createdAt": "2026-10-16T10:00:00Z",
        "feedback": feedback,
        "meta": {},
    }


def test_closed_line_shows_the_visitor_review():
    assert presenters.system_label(closed(1)).endswith("· VISITOR RATED IT HELPFUL")
    assert presenters.system_label(closed(-1)).endswith("· VISITOR RATED IT NOT HELPFUL")
    unrated = presenters.system_label(closed())
    assert unrated.startswith("CONVERSATION CLOSED")
    assert "RATED" not in unrated
