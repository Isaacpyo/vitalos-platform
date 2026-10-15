"""In-memory stand-in for the website's Relay admin API: tests and local UI work (``RELAY_CLIENT=fake``).

Sample data uses only fictional people and organisations (Alex Morgan, Example Care Group, ...) and
reserved ``example.com`` addresses. The fake imitates the website's responses closely enough to render
every Relay page; it is not the source of any rule (the website enforces status transitions).
Production refuses ``RELAY_CLIENT=fake`` (config/settings/prod.py).
"""

from __future__ import annotations

import copy
import threading
import uuid
from datetime import UTC as _UTC
from datetime import datetime, timedelta

from .client import AdminApiMixin, RelayError, _id

ALEX = "4f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e01"
VISITOR_8C1D = "8c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d402"
JORDAN = "2b6e8f10-3c4d-4e5f-8a6b-7c8d9e0f1a03"
VISITOR_21AF = "21af3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c04"
VISITOR_7B90 = "7b90d1e2-f3a4-4b5c-9d6e-7f8091a2b305"
VISITOR_3E52 = "3e52f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f06"
TEAM_ANSWER = "9d0c1b2a-3e4f-4a5b-8c6d-7e8f9a0b1c11"
CMS_DOC = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c12"
FAQ_DOC = "5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e13"
GAP_ISO = "6e7f8091-a2b3-4c4d-9e5f-6a7b8c9d0e21"

DEFAULT_SETTINGS = {
    "aiEnabled": True,
    "model": "deepseek-flash",
    "businessHours": {"days": [1, 2, 3, 4, 5], "start": "09:00", "end": "17:30", "timezone": "Europe/London"},
    "outOfHoursText": "The team is away right now. Leave your details and someone will reply on the next working day.",
    "reminderMinutes": 10,
    "secondReminderMinutes": 30,
    "emailSnippet": True,
    "visitorEmailsEnabled": False,
    "greeting": "Hello. I am Relay, the Vitalos assistant. Ask about our work, or ask for a person at any time.",
    "suggestedQuestions": [
        "What does Vitalos do?",
        "How does an engagement start?",
        "Can you modernise an existing system?",
        "Can I talk to a person?",
    ],
    "confidenceThreshold": 0.4,
    "dailyTokenCap": 2000000,
    "retention": {"noContactDays": 90, "withContactDays": 365},
    "allowedOrigins": ["https://www.vitalos.co.uk"],
}


def _iso(moment: datetime) -> str:
    return moment.astimezone(_UTC).isoformat().replace("+00:00", "Z")


def _message(sender, body, at, **extra):
    message = {
        "id": str(uuid.uuid4()),
        "senderType": sender,
        "body": body,
        "adminName": None,
        "adminInitials": None,
        "citations": [],
        "confidence": None,
        "feedback": None,
        "latencyMs": None,
        "handoffSuggested": False,
        "createdAt": _iso(at),
        "meta": {},
    }
    message.update(extra)
    return message


def _citations(count):
    titles = ["Application Modernisation", "How engagements start", "Technology Health Assessment"]
    return [
        {"n": n + 1, "title": titles[n % 3], "url": "https://www.vitalos.co.uk/", "type": "offer"}
        for n in range(count)
    ]


def _session(page, now, minutes, count, referrer="Google search", device="Desktop · Chrome"):
    return {
        "pageUrl": f"https://www.vitalos.co.uk{page}",
        "pageTitle": "Vitalos",
        "referrer": referrer,
        "device": device,
        "country": "United Kingdom",
        "startedAt": _iso(now - timedelta(minutes=minutes)),
        "messageCount": count,
    }


def _seed(now: datetime) -> dict:
    t = lambda minutes: now - timedelta(minutes=minutes)  # noqa: E731
    conversations = {
        ALEX: {
            "id": ALEX,
            "status": "awaiting_human",
            "contact": {
                "name": "Alex Morgan",
                "email": "alex.morgan@example.com",
                "company": "Example Care Group",
                "consentAt": _iso(t(4)),
                "noticeVersion": "1.0",
            },
            "session": _session("/application-modernisation", now, 7, 4),
            "summary": "Care provider with a ten-year-old scheduling system. Wants modernisation rather than "
            "replacement; asked for a timeline, which Relay could not give.",
            "summaryMeta": {"intent": "modernisation", "sector": "health and care", "urgency": "normal"},
            "assigned": None,
            "handoff": {"trigger": "not_helpful", "requestedAt": _iso(t(4))},
            "firstAdminJoinedAt": None,
            "visitorLastSeenAt": _iso(t(1)),
            "closedAt": None,
            "tags": ["NOT_HELPFUL"],
            "pagePath": "/application-modernisation",
            "aiTurns": 2,
            "messages": [
                _message(
                    "visitor",
                    "We're a care provider with a ten-year-old scheduling system. Could you modernise it rather than replace it?",
                    t(7),
                ),
                _message(
                    "ai",
                    "Yes. Application Modernisation is one of our core offers. We start by assessing the current "
                    "system, its data and its integrations, then agree which parts to keep, re-platform or rebuild.",
                    t(7),
                    citations=_citations(3),
                    confidence=0.78,
                    latencyMs=1400,
                ),
                _message("visitor", "Roughly how long would that take?", t(5)),
                _message(
                    "ai",
                    "That depends on the size of the system and what the assessment finds, so I can't give you a "
                    "reliable timeline here.",
                    t(5),
                    citations=_citations(1),
                    confidence=0.51,
                    latencyMs=1200,
                    feedback=-1,
                ),
                _message(
                    "system",
                    "handoff_requested",
                    t(4),
                    meta={"trigger": "not_helpful", "consent": True},
                ),
            ],
        },
        VISITOR_8C1D: {
            "id": VISITOR_8C1D,
            "status": "awaiting_human",
            "contact": None,
            "session": _session("/trust", now, 14, 2, referrer="Direct", device="Mobile · Safari"),
            "summary": "Asked whether Vitalos holds ISO 27001 certification. Not covered by published knowledge.",
            "summaryMeta": None,
            "assigned": None,
            "handoff": {"trigger": "low_confidence", "requestedAt": _iso(t(12))},
            "firstAdminJoinedAt": None,
            "visitorLastSeenAt": _iso(t(9)),
            "closedAt": None,
            "tags": ["NOT_IN_KNOWLEDGE"],
            "pagePath": "/trust",
            "aiTurns": 1,
            "messages": [
                _message("visitor", "Do you hold ISO 27001 certification?", t(13)),
                _message(
                    "ai",
                    "I don't know that from what Vitalos has published. Would you like a person to answer?",
                    t(13),
                    confidence=0.21,
                    latencyMs=900,
                    handoffSuggested=True,
                ),
                _message(
                    "system", "handoff_requested", t(12), meta={"trigger": "low_confidence", "consent": False}
                ),
            ],
        },
        JORDAN: {
            "id": JORDAN,
            "status": "human",
            "contact": {
                "name": "Jordan Ellis",
                "email": "jordan.ellis@example.com",
                "company": "Example Logistics Ltd",
                "consentAt": _iso(t(30)),
                "noticeVersion": "1.0",
            },
            "session": _session("/how-we-work", now, 34, 6),
            "summary": "Interested in a discovery call about a data platform. Person joined.",
            "summaryMeta": None,
            "assigned": {"id": "sa:9999", "name": "Sam Taylor", "initials": "ST"},
            "handoff": {"trigger": "explicit_request", "requestedAt": _iso(t(30))},
            "firstAdminJoinedAt": _iso(t(28)),
            "visitorLastSeenAt": _iso(t(2)),
            "closedAt": None,
            "tags": ["ASKED_FOR_A_PERSON"],
            "pagePath": "/how-we-work",
            "aiTurns": 2,
            "messages": [
                _message("visitor", "Can I talk to someone about a data platform?", t(31)),
                _message(
                    "system",
                    "handoff_requested",
                    t(30),
                    meta={"trigger": "explicit_request", "consent": True},
                ),
                _message("system", "admin_joined", t(28), meta={"name": "Sam Taylor"}),
                _message(
                    "admin",
                    "Hello Jordan, I'm Sam. Happy to help. What does the platform need to do?",
                    t(27),
                    adminName="Sam Taylor",
                    adminInitials="ST",
                ),
                _message(
                    "note",
                    "Warm lead. Offer a discovery call.",
                    t(26),
                    adminName="Sam Taylor",
                    adminInitials="ST",
                ),
                _message("visitor", "Thanks, that's useful. Can we book a call?", t(3)),
            ],
        },
        VISITOR_21AF: {
            "id": VISITOR_21AF,
            "status": "ai",
            "contact": None,
            "session": _session("/industries", now, 20, 2),
            "summary": None,
            "summaryMeta": None,
            "assigned": None,
            "handoff": None,
            "firstAdminJoinedAt": None,
            "visitorLastSeenAt": _iso(t(18)),
            "closedAt": None,
            "tags": [],
            "pagePath": "/industries",
            "aiTurns": 1,
            "messages": [
                _message("visitor", "Which sectors do you work in?", t(19)),
                _message(
                    "ai",
                    "Vitalos works across several sectors, including health and care.",
                    t(18),
                    citations=_citations(2),
                    confidence=0.81,
                    latencyMs=1100,
                ),
            ],
        },
        VISITOR_7B90: {
            "id": VISITOR_7B90,
            "status": "ai",
            "contact": None,
            "session": _session("/labs", now, 43, 2),
            "summary": None,
            "summaryMeta": None,
            "assigned": None,
            "handoff": None,
            "firstAdminJoinedAt": None,
            "visitorLastSeenAt": _iso(t(41)),
            "closedAt": None,
            "tags": [],
            "pagePath": "/labs",
            "aiTurns": 1,
            "messages": [
                _message("visitor", "What happens in an AI Prototype Sprint?", t(42)),
                _message(
                    "ai",
                    "An AI Prototype Sprint is a short, fixed-scope piece of work to test an idea.",
                    t(41),
                    citations=_citations(1),
                    confidence=0.74,
                    latencyMs=1300,
                ),
            ],
        },
        VISITOR_3E52: {
            "id": VISITOR_3E52,
            "status": "closed",
            "contact": None,
            "session": _session("/", now, 26 * 60, 3),
            "summary": "General question about the company, answered by Relay.",
            "summaryMeta": None,
            "assigned": None,
            "handoff": None,
            "firstAdminJoinedAt": None,
            "visitorLastSeenAt": _iso(t(26 * 60)),
            "closedAt": _iso(t(25 * 60)),
            "tags": [],
            "pagePath": "/",
            "aiTurns": 1,
            "messages": [
                _message("visitor", "Where is Vitalos based?", t(26 * 60)),
                _message(
                    "ai", "Vitalos is a UK company.", t(26 * 60), citations=_citations(1), confidence=0.9
                ),
                _message("system", "closed", t(25 * 60)),
            ],
        },
    }
    documents = {
        CMS_DOC: {
            "id": CMS_DOC,
            "source": "cms",
            "title": "Application Modernisation",
            "url": "https://www.vitalos.co.uk/solutions/application-modernisation",
            "type": "offer",
            "owner": "Website",
            "reviewDate": None,
            "bodyMd": "## What it is\n\nAssess, then keep, re-platform or rebuild.",
            "status": "published",
            "meta": {"section": "Engineering"},
            "adminMeta": {},
            "updatedAt": _iso(t(60 * 24)),
            "updatedBy": None,
            "readOnly": True,
            "chunks": 5,
            "externalId": None,
            "section": "Engineering",
            "notionUrl": None,
        },
        "7f8e9d0c-1b2a-4c3d-8e4f-5a6b7c8d9e14": {
            "id": "7f8e9d0c-1b2a-4c3d-8e4f-5a6b7c8d9e14",
            "source": "repo",
            "title": "How engagements start",
            "url": None,
            "type": "guide",
            "owner": "Delivery",
            "reviewDate": None,
            "bodyMd": "Every engagement starts with a short conversation.",
            "status": "published",
            "meta": {},
            "adminMeta": {},
            "updatedAt": _iso(t(60 * 72)),
            "updatedBy": None,
            "readOnly": True,
            "chunks": 3,
            "externalId": None,
            "section": None,
            "notionUrl": None,
        },
        TEAM_ANSWER: {
            "id": TEAM_ANSWER,
            "source": "team_answer",
            "title": "Can you work with our in-house team?",
            "url": None,
            "type": "faq",
            "owner": "Delivery",
            "reviewDate": None,
            "bodyMd": "Yes. We often work alongside in-house teams.",
            "status": "draft",
            "meta": {},
            "adminMeta": {},
            "updatedAt": _iso(t(90)),
            "updatedBy": "sa:9999",
            "readOnly": False,
            "chunks": 1,
            "externalId": None,
            "section": None,
            "notionUrl": None,
        },
        FAQ_DOC: {
            "id": FAQ_DOC,
            "source": "faq",
            "title": "How many practices does Vitalos have?",
            "url": None,
            "type": "faq",
            "owner": "Founder",
            "reviewDate": None,
            "bodyMd": "Six practices.",
            "status": "published",
            "meta": {},
            "adminMeta": {},
            "updatedAt": _iso(t(60 * 5)),
            "updatedBy": None,
            "readOnly": True,
            "chunks": 1,
            "externalId": "ABT-01",
            "section": "About",
            "notionUrl": "https://app.notion.com/p/3fae4b3411f9808cb450c69d43e8f22c",
        },
    }
    return {
        "conversations": conversations,
        "documents": documents,
        "gaps": [
            {
                "id": GAP_ISO,
                "count": 3,
                "question": "Do you hold ISO 27001 certification?",
                "lastAskedAt": _iso(t(12)),
                "status": "open",
            },
            {
                "id": "8091a2b3-c4d5-4e6f-8a7b-8c9d0e1f2a22",
                "count": 2,
                "question": "What are your day rates?",
                "lastAskedAt": _iso(t(300)),
                "status": "open",
            },
        ],
        "settings": copy.deepcopy(DEFAULT_SETTINGS),
        "presence": {},
        "calls": [],
        "fail_with": None,
    }


class FakeState:
    """Process-wide sample data, shared by every FakeRelayClient (so local edits persist)."""

    def __init__(self):
        self.lock = threading.RLock()
        self.reset()

    def reset(self, now: datetime | None = None) -> None:
        with getattr(self, "lock", threading.RLock()):
            self.now = now or datetime.now(_UTC)
            self.data = _seed(self.now)

    @property
    def calls(self) -> list[tuple[str, str, str]]:
        return self.data["calls"]

    def fail_next(self, error: RelayError | None) -> None:
        self.data["fail_with"] = error


STATE = FakeState()


def _row(conversation: dict) -> dict:
    last = next(
        (m for m in reversed(conversation["messages"]) if m["senderType"] in ("visitor", "ai", "admin")), None
    )
    waiting = (conversation.get("handoff") or {}).get("requestedAt")
    return {
        "id": conversation["id"],
        "status": conversation["status"],
        "displayName": _display_name(conversation),
        "contactName": (conversation.get("contact") or {}).get("name"),
        "lastMessage": {
            "body": (last["body"] if last else "")[:140],
            "senderType": last["senderType"] if last else "system",
            "at": last["createdAt"] if last else None,
        },
        "waitingSince": waiting if conversation["status"] == "awaiting_human" else None,
        "assigned": conversation.get("assigned"),
        "tags": list(conversation.get("tags") or []),
        "pagePath": conversation.get("pagePath"),
        "lastMessageAt": last["createdAt"] if last else conversation["session"]["startedAt"],
        "aiTurns": conversation.get("aiTurns", 0),
    }


def _display_name(conversation: dict) -> str:
    name = (conversation.get("contact") or {}).get("name")
    return name or f"Visitor {conversation['id'][:4].upper()}"


def _public(conversation: dict) -> dict:
    result = {
        key: value for key, value in conversation.items() if key not in ("messages", "pagePath", "aiTurns")
    }
    result["displayName"] = _display_name(conversation)
    return copy.deepcopy(result)


TAB_STATUS = {"needs": "awaiting_human", "live": "human", "ai": "ai", "closed": "closed"}


class FakeRelayClient(AdminApiMixin):
    """Answers the admin API from ``STATE``. Records every call as (method, path, admin id)."""

    def __init__(self, admin: dict | None = None):
        self.admin = admin

    # The fake routes calls by method and path, like the website would.
    def _call(self, method, path, query=None, body=None):
        with STATE.lock:
            STATE.calls.append((method, path, (self.admin or {}).get("id", "")))
            failure = STATE.data.get("fail_with")
            if failure is not None:
                STATE.data["fail_with"] = None
                raise failure
            return copy.deepcopy(self._route(method, path, query or {}, body or {}))

    def _now(self) -> str:
        return _iso(datetime.now(_UTC))

    def _conversation(self, conversation_id: str) -> dict:
        conversation = STATE.data["conversations"].get(conversation_id)
        if conversation is None:
            raise RelayError("not_found", 404)
        return conversation

    def _me(self) -> dict:
        admin = self.admin or {"id": "sa:0", "name": "Admin", "initials": "AD"}
        return {key: admin[key] for key in ("id", "name", "initials")}

    def _require_superadmin(self):
        if (self.admin or {}).get("role") != "SuperAdmin":
            raise RelayError("forbidden", 403)

    def _join(self, conversation: dict) -> None:
        if conversation["status"] == "closed":
            raise RelayError("conflict", 409)
        if conversation["status"] != "human":
            conversation["status"] = "human"
            conversation["firstAdminJoinedAt"] = conversation.get("firstAdminJoinedAt") or self._now()
            conversation["messages"].append(
                _message("system", "admin_joined", datetime.now(_UTC), meta={"name": self._me()["name"]})
            )
        conversation["assigned"] = self._me()

    def _route(self, method, path, query, body):  # noqa: C901 - one branch per route, like a router
        data = STATE.data
        parts = path.strip("/").split("/")
        if path == "/inbox":
            tab = query.get("tab") or "needs"
            q = (query.get("q") or "").lower()
            rows = [_row(c) for c in data["conversations"].values() if c["status"] == TAB_STATUS.get(tab, "")]
            if q:
                rows = [
                    r
                    for r in rows
                    if q in r["displayName"].lower()
                    or q in r["lastMessage"]["body"].lower()
                    or q in ((data["conversations"][r["id"]].get("contact") or {}).get("email") or "").lower()
                ]
            if tab == "needs":
                rows.sort(key=lambda r: r["waitingSince"] or "")
            else:
                rows.sort(key=lambda r: r["lastMessageAt"], reverse=True)
            counts = {
                key: sum(1 for c in data["conversations"].values() if c["status"] == status)
                for key, status in TAB_STATUS.items()
            }
            return {"counts": counts, "items": rows, "nextCursor": None, "realtime": None}
        if parts[0] == "conversations":
            conversation = self._conversation(parts[1])
            action = parts[2] if len(parts) > 2 else ""
            if method == "GET" and not action:
                return {
                    "conversation": _public(conversation),
                    "messages": conversation["messages"],
                    "visitorTyping": False,
                }
            if action == "messages":
                after = query.get("after") or ""
                return {
                    "messages": [m for m in conversation["messages"] if m["createdAt"] > after],
                    "status": conversation["status"],
                    "assigned": conversation["assigned"],
                    "visitorTyping": False,
                }
            if method == "DELETE":
                del data["conversations"][parts[1]]
                return {}
            if action == "join":
                self._join(conversation)
            elif action == "assign":
                conversation["assigned"] = body["admin"]
            elif action == "handback":
                if conversation["status"] == "closed":
                    raise RelayError("conflict", 409)
                conversation["status"] = "ai"
                conversation["assigned"] = None
                conversation["messages"].append(_message("system", "ai_back", datetime.now(_UTC)))
            elif action == "close":
                conversation["status"] = "closed"
                conversation["closedAt"] = self._now()
                conversation["messages"].append(_message("system", "closed", datetime.now(_UTC)))
            elif action == "reply":
                self._join(conversation)
                me = self._me()
                message = _message(
                    "admin",
                    body["text"],
                    datetime.now(_UTC),
                    adminName=me["name"],
                    adminInitials=me["initials"],
                )
                conversation["messages"].append(message)
                return {"message": message, "emailed": False, "conversation": _public(conversation)}
            elif action == "note":
                me = self._me()
                message = _message(
                    "note",
                    body["text"],
                    datetime.now(_UTC),
                    adminName=me["name"],
                    adminInitials=me["initials"],
                )
                conversation["messages"].append(message)
                return {"message": message}
            elif action == "typing":
                return {}
            elif action == "save-to-knowledge":
                document_id = str(uuid.uuid4())
                data["documents"][document_id] = {
                    **copy.deepcopy(data["documents"][TEAM_ANSWER]),
                    "id": document_id,
                    "title": "Saved answer",
                    "updatedAt": self._now(),
                }
                return {"documentId": document_id}
            elif action == "transcript":
                lines = [
                    f"{m['senderType'].upper()} {m['createdAt']}: {m['body']}"
                    for m in conversation["messages"]
                    if m["senderType"] in ("visitor", "ai", "admin")
                ]
                return {"text": "\n".join(lines)}
            return {"conversation": _public(conversation)}
        if path == "/presence":
            if method == "POST":
                data["presence"][self._me()["id"]] = bool(body.get("available"))
                return {"teamStatus": "online" if any(data["presence"].values()) else "offline"}
            admins = [
                {"id": admin_id, "name": admin_id, "available": available, "lastSeenAt": self._now()}
                for admin_id, available in data["presence"].items()
            ]
            return {"admins": admins, "teamStatus": "online" if any(data["presence"].values()) else "offline"}
        if parts[0] == "knowledge":
            return self._knowledge(method, parts[1:], query, body)
        if path == "/insights":
            return {
                "conversations": 128,
                "aiResolved": 97,
                "handoffRate": 0.14,
                "helpful": 61,
                "notHelpful": 9,
                "medianFirstReplySeconds": 260,
                "waitingNow": sum(
                    1 for c in data["conversations"].values() if c["status"] == "awaiting_human"
                ),
                "topQuestions": [
                    {"question": "What does Vitalos do?", "count": 22},
                    {"question": "How does an engagement start?", "count": 14},
                ],
                "topGaps": [{"question": g["question"], "count": g["count"]} for g in data["gaps"]],
                "tokensIn": 1250000,
                "tokensOut": 310000,
                "cacheHitTokens": 820000,
                "estCostUsd": 1.42,
            }
        if path == "/settings":
            if method == "PUT":
                self._require_superadmin()
                data["settings"] = copy.deepcopy(body["settings"])
            return {"settings": data["settings"]}
        if path == "/email-log":
            return {
                "emails": [
                    {
                        "id": "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c31",
                        "to": "jordan.ellis@example.com",
                        "subject": "Your conversation with Vitalos",
                        "provider": "log",
                        "status": "logged",
                        "createdAt": self._now(),
                    }
                ]
            }
        raise RelayError("not_found", 404)

    def _knowledge(self, method, parts, query, body):
        data = STATE.data
        documents = data["documents"]
        if not parts:
            if method == "POST":
                document_id = str(uuid.uuid4())
                documents[document_id] = {
                    **copy.deepcopy(documents[TEAM_ANSWER]),
                    **{
                        key: body.get(key)
                        for key in ("title", "url", "type", "owner", "reviewDate", "bodyMd")
                    },
                    "id": document_id,
                    "status": "draft",
                    "updatedAt": self._now(),
                    "updatedBy": self._me()["id"],
                }
                return {"document": documents[document_id]}
            items = list(documents.values())
            for key in ("source", "status", "section"):
                if query.get(key):
                    items = [d for d in items if (d.get(key) or "") == query[key]]
            if query.get("q"):
                items = [d for d in items if query["q"].lower() in d["title"].lower()]
            fields = ("id", "source", "title", "type", "status", "chunks", "updatedAt", "url")
            fields += ("externalId", "section", "readOnly", "notionUrl")
            synced = _iso(STATE.now - timedelta(minutes=10))
            return {
                "sources": {
                    "cms": {"count": 42, "syncedAt": synced},
                    "repo": {"count": 18, "syncedAt": synced},
                    "team_answer": {"count": 6, "syncedAt": synced},
                    "faq": {"verified": 31, "awaiting": 4, "held": 1, "syncedAt": synced, "mode": "snapshot"},
                },
                "items": [{key: d.get(key) for key in fields} for d in items],
            }
        head = parts[0]
        if head == "reindex-all":
            self._require_superadmin()
            return {"documents": len(documents), "chunks": sum(d["chunks"] for d in documents.values())}
        if head == "gaps":
            if len(parts) == 3 and parts[2] == "ignore":
                data["gaps"] = [g for g in data["gaps"] if g["id"] != parts[1]]
                return {}
            return {"gaps": data["gaps"]}
        if head == "test":
            question = body.get("question", "")
            return {
                "threshold": data["settings"]["confidenceThreshold"],
                "confident": bool(question),
                "chunks": [
                    {
                        "documentId": CMS_DOC,
                        "title": "Engineering Rescue",
                        "heading": "§2",
                        "content": "When a project is failing, we start with a short review.",
                        "confidence": 0.82,
                        "similarity": 0.79,
                        "rrfScore": 0.031,
                        "source": "cms",
                        "type": "offer",
                    },
                    {
                        "documentId": CMS_DOC,
                        "title": "Technology Health Assessment",
                        "heading": "§1",
                        "content": "A fixed-scope review of systems, risks and options.",
                        "confidence": 0.61,
                        "similarity": 0.58,
                        "rrfScore": 0.022,
                        "source": "cms",
                        "type": "offer",
                    },
                    {
                        "documentId": TEAM_ANSWER,
                        "title": "How engagements start",
                        "heading": "§3",
                        "content": "Every engagement starts with a short conversation.",
                        "confidence": 0.31,
                        "similarity": 0.41,
                        "rrfScore": 0.015,
                        "source": "repo",
                        "type": "guide",
                    },
                ],
            }
        if head == "faq":
            if len(parts) > 1 and parts[1] == "sync":
                self._require_superadmin()
                return {"run": self._faq_run()}
            return {
                "needsConfirmation": [
                    {
                        "externalId": "SVC-07",
                        "question": "Do you offer fixed-price projects?",
                        "section": "Services",
                        "confirmNote": "Confirm whether fixed price is offered for every practice.",
                        "notionUrl": "https://app.notion.com/p/3fae4b3411f9808cb450c69d43e8f22c",
                    }
                ],
                "held": [
                    {
                        "externalId": "TRU-03",
                        "question": "Which certifications do you hold?",
                        "reasons": ["Mentions a certification"],
                    }
                ],
                "lastRun": self._faq_run(),
                "hubActive": False,
                "mode": "snapshot",
            }
        document = documents.get(_id(head))
        if document is None:
            raise RelayError("not_found", 404)
        action = parts[1] if len(parts) > 1 else ""
        if method == "PATCH":
            if document["readOnly"]:
                raise RelayError("read_only", 409)
            document.update({key: body.get(key) for key in body})
            document["updatedAt"] = self._now()
        elif action in ("publish", "archive", "reindex"):
            self._require_superadmin()
            if action != "reindex":
                document["status"] = "published" if action == "publish" else "archived"
        return {"document": document}

    def _faq_run(self):
        started = STATE.now - timedelta(minutes=15)
        return {
            "startedAt": _iso(started),
            "finishedAt": _iso(started + timedelta(seconds=20)),
            "mode": "snapshot",
            "added": 0,
            "updated": 2,
            "archived": 0,
            "held": 1,
            "skippedUnverified": 4,
            "errors": 0,
        }
