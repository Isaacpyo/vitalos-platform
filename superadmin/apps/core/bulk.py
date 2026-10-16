"""Shared plumbing for checkbox bulk actions on the Careers and Insights lists.

A bulk action is only a loop over the single-item action: every item goes through the same service
function, the same permission check and the same readiness checks as its detail page, each inside its
own savepoint so one failure never stops or rolls back the others. This module owns the generic parts
(validating the posted IDs, running the loop, the summary message); the apps own what each action does.
"""

import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field

from django.contrib import messages
from django.core.exceptions import BadRequest, PermissionDenied, ValidationError
from django.db import transaction
from django.http import QueryDict

logger = logging.getLogger(__name__)

MAX_ITEMS = 100


@dataclass(frozen=True)
class BulkAction:
    key: str
    label: str  # button/option text, e.g. "Open"
    done: str  # past tense for the summary, e.g. "opened"
    confirm: bool = False  # changes the live website, so it needs a confirmation step
    warning: str = ""  # shown on the confirmation page


@dataclass
class BulkResult:
    done: int = 0
    failed: list[tuple[str, str]] = field(default_factory=list)


def selected_ids(post: QueryDict) -> list[uuid.UUID]:
    """The posted ``ids`` as unique UUIDs, in posted order. Anything malformed is a 400."""
    ids: list[uuid.UUID] = []
    for raw in post.getlist("ids"):
        try:
            value = uuid.UUID(raw)
        except (ValueError, AttributeError, TypeError):
            raise BadRequest("Invalid selection.") from None
        if value not in ids:
            ids.append(value)
    if len(ids) > MAX_ITEMS:
        raise BadRequest("Too many items selected.")
    return ids


def load_items(model, ids: list[uuid.UUID]) -> list:
    """The rows for ``ids`` in posted order. An ID that does not exist is a 400."""
    found = {item.pk: item for item in model.objects.filter(pk__in=ids)}
    if len(found) != len(ids):
        raise BadRequest("Unknown item in the selection.")
    return [found[pk] for pk in ids]


def return_query(post: QueryDict) -> str:
    """The list's own querystring (tab, filters, page), re-encoded so nothing else can ride along."""
    return QueryDict(post.get("qs", "")[:500]).urlencode()


def run(
    items, action: BulkAction, apply: Callable[[object], None], title: Callable[[object], str]
) -> BulkResult:
    """Apply ``apply(item)`` to each item independently. A validation or permission failure, or any
    unexpected error, is recorded against that item and the loop carries on."""
    result = BulkResult()
    for item in items:
        try:
            with transaction.atomic():
                apply(item)
        except ValidationError as exc:
            result.failed.append((title(item), " ".join(exc.messages)))
        except PermissionDenied:
            result.failed.append((title(item), "You do not have permission to do this."))
        except Exception:
            logger.exception("Bulk %s failed for %s", action.key, getattr(item, "pk", "?"))
            result.failed.append((title(item), "Something went wrong. Nothing was changed."))
        else:
            result.done += 1
    return result


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


def report(request, result: BulkResult, action: BulkAction, noun: str) -> None:
    """One Django message, for example "3 roles opened. 1 could not be opened: Title — reason."."""
    parts = []
    if result.done:
        parts.append(f"{_plural(result.done, noun)} {action.done}.")
    if result.failed:
        detail = "; ".join(f"{title} — {reason.rstrip('.')}" for title, reason in result.failed)
        parts.append(f"{len(result.failed)} could not be {action.done}: {detail}.")
    text = " ".join(parts)
    if result.failed:
        messages.error(request, text)
    else:
        messages.success(request, text)
