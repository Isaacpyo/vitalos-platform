"""Client portal data (ADR-056).

Every customer-facing record has an explicit publication state, and every field that is internal-only is named
``internal_*`` so the customer templates, serialisers and AI context builders can be checked for it by tests.
Customers never read these models directly: they go through ``selectors.py`` (scoped by organisation and
publication). Writes go through ``services.py``.
"""

from __future__ import annotations

import secrets

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

User = settings.AUTH_USER_MODEL


class Role(models.TextChoices):
    VIEWER = "viewer", "Viewer"
    CONTRIBUTOR = "contributor", "Contributor"
    APPROVER = "approver", "Approver"
    SIGNATORY = "signatory", "Authorised signatory"


ROLE_LEVEL = {Role.VIEWER: 1, Role.CONTRIBUTOR: 2, Role.APPROVER: 3, Role.SIGNATORY: 4}
ROLE_HELP = {
    Role.VIEWER: "Read-only.",
    Role.CONTRIBUTOR: "Read, comment, answer questions, upload files and request changes.",
    Role.APPROVER: "Everything a contributor can do, plus approving or requesting changes to a specific deliverable version.",
    Role.SIGNATORY: "Everything an approver can do, plus contractual acceptance on the organisation's behalf.",
}


class Organisation(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True)
    is_synthetic = models.BooleanField(
        default=False, help_text="Made-up demonstration data. Shown to the customer UI as a banner."
    )
    is_active = models.BooleanField(default=True)
    retention_note = models.CharField(max_length=300, blank=True)
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Membership(models.Model):
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="portal_memberships")
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.VIEWER)
    is_active = models.BooleanField(default=True)
    job_title = models.CharField(max_length=120, blank=True)
    invited_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    # Last-visit tracking for "What changed since my last visit?". A new visit starts after 30 idle minutes.
    last_seen_at = models.DateTimeField(null=True, blank=True)
    previous_visit_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["organisation__name", "user__email"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "user"], name="portal_one_member_per_org")
        ]

    def __str__(self):
        return f"{self.user} ({self.organisation})"

    @property
    def level(self) -> int:
        return ROLE_LEVEL.get(self.role, 0)

    @property
    def name(self) -> str:
        return self.user.full_name or self.user.email

    @property
    def can_comment(self) -> bool:
        return self.level >= ROLE_LEVEL[Role.CONTRIBUTOR]

    @property
    def can_approve(self) -> bool:
        return self.level >= ROLE_LEVEL[Role.APPROVER]

    @property
    def can_accept_contract(self) -> bool:
        return self.role == Role.SIGNATORY


def _token() -> str:
    return secrets.token_urlsafe(32)


class Invitation(models.Model):
    """A single-use, expiring invitation. Only the SHA-256 hash of the token is stored."""

    membership = models.ForeignKey(Membership, on_delete=models.CASCADE, related_name="invitations")
    token_hash = models.CharField(max_length=64, unique=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invitation for {self.membership_id}"

    @property
    def is_usable(self) -> bool:
        return self.used_at is None and self.revoked_at is None and self.expires_at > timezone.now()

    @property
    def state(self) -> str:
        if self.used_at:
            return "used"
        if self.revoked_at:
            return "revoked"
        if self.expires_at <= timezone.now():
            return "expired"
        return "pending"


# --- Challenge and brief --------------------------------------------------------------------------------------


class Journey(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    DISCOVERY = "discovery", "Discovery"
    ASSESSMENT = "assessment", "Assessment"
    PROPOSAL = "proposal", "Proposal"
    ACTIVE = "active", "Active project"
    HANDOVER = "handover", "Handover"
    MANAGED = "managed", "Managed operations"


JOURNEY_ORDER = [choice.value for choice in Journey]


class Challenge(models.Model):
    """What the customer asked Vitalos to help with. Linked, explicitly, to one ``aidata.Opportunity``.

    The opportunity keeps the original submission and its history. The text shown to the customer here is a
    snapshot taken when staff link it (and editable before sharing), so internal edits to the opportunity never
    leak and the customer's own words are preserved.
    """

    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="challenges")
    opportunity = models.OneToOneField(
        "aidata.Opportunity", on_delete=models.PROTECT, related_name="portal_challenge"
    )
    title = models.CharField(max_length=200)
    submitted_problem = models.TextField(blank=True)
    submitted_outcome = models.TextField(blank=True)
    submitted_at = models.DateTimeField(default=timezone.now)
    journey_stage = models.CharField(max_length=12, choices=Journey.choices, default=Journey.SUBMITTED)
    status_note = models.CharField(max_length=300, blank=True, help_text="Customer-visible one-line status.")
    # Explicit staff action. Until it is set the customer cannot see the challenge at all.
    shared_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.title

    @property
    def is_shared(self) -> bool:
        return self.shared_at is not None


class BriefStatus(models.TextChoices):
    DRAFT = "draft", "Draft (internal)"
    PROPOSED = "proposed", "Proposed"
    AGREED = "agreed", "Agreed"
    CHANGES_REQUESTED = "changes_requested", "Changes requested"
    SUPERSEDED = "superseded", "Superseded"


class Provenance(models.TextChoices):
    CUSTOMER = "customer_statement", "Customer statement"
    AI = "ai_suggestion", "AI suggestion"
    FACT = "agreed_fact", "Agreed fact"


class BriefVersion(models.Model):
    """Segments: ``[{"id": "s1", "text": "...", "provenance": "customer_statement"|"ai_suggestion"|"agreed_fact"}]``.

    A draft is internal. A proposed version is visible so the customer can accept it or request changes. An
    AI-suggested segment is only ever visible inside a version a person proposed, and it is labelled.
    """

    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="briefs")
    number = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=BriefStatus.choices, default=BriefStatus.DRAFT)
    summary = models.CharField(max_length=300, blank=True)
    segments = models.JSONField(default=list)
    change_note = models.CharField(max_length=300, blank=True)
    internal_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)
    proposed_at = models.DateTimeField(null=True, blank=True)
    agreed_at = models.DateTimeField(null=True, blank=True)
    agreed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-number"]
        constraints = [models.UniqueConstraint(fields=["challenge", "number"], name="portal_brief_number")]

    def __str__(self):
        return f"Brief v{self.number}"

    def clean(self):
        validate_segments(self.segments)


def validate_segments(segments) -> None:
    if not isinstance(segments, list):
        raise ValidationError("Segments must be a list.")
    allowed = set(Provenance.values)
    for index, segment in enumerate(segments, start=1):
        if not isinstance(segment, dict) or not str(segment.get("text", "")).strip():
            raise ValidationError(f"Segment {index} needs text.")
        if segment.get("provenance") not in allowed:
            raise ValidationError(f"Segment {index} needs a provenance tag.")
        if len(str(segment["text"])) > 2000:
            raise ValidationError(f"Segment {index} is longer than 2,000 characters.")


class BriefReview(models.Model):
    class Decision(models.TextChoices):
        ACCEPTED = "accepted", "Accepted"
        CHANGES = "changes_requested", "Changes requested"

    brief = models.ForeignKey(BriefVersion, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")
    decision = models.CharField(max_length=20, choices=Decision.choices)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.decision} on brief {self.brief_id}"


# --- Project ----------------------------------------------------------------------------------------------------


class ProjectStatus(models.TextChoices):
    PLANNING = "planning", "Planning"
    ACTIVE = "active", "Active"
    ON_HOLD = "on_hold", "On hold"
    HANDOVER = "handover", "Handover"
    COMPLETE = "complete", "Complete"


class Project(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    agreed_scope = models.TextField(
        blank=True, help_text="Changes only through the staff change process; the portal never edits it."
    )
    status = models.CharField(max_length=12, choices=ProjectStatus.choices, default=ProjectStatus.PLANNING)
    target_date = models.DateField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)
    # The approved ``aidata.Draft`` (proposal) this project was prefilled from; makes the action idempotent.
    # A plain number, not a foreign key: the portal never depends on the workspace's tables.
    source_proposal_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name


class ItemKind(models.TextChoices):
    RESPONSIBILITY = "responsibility", "Responsibility"
    DEPENDENCY = "dependency", "Dependency"
    BLOCKER = "blocker", "Blocker"


class Party(models.TextChoices):
    VITALOS = "vitalos", "Vitalos"
    CUSTOMER = "customer", "Customer"


class ProjectItem(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="items")
    kind = models.CharField(max_length=16, choices=ItemKind.choices)
    party = models.CharField(max_length=10, choices=Party.choices)
    text = models.CharField(max_length=500)
    due_date = models.DateField(null=True, blank=True)
    is_done = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["kind", "is_done", "due_date", "id"]

    def __str__(self):
        return self.text


class MilestoneStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not started"
    IN_PROGRESS = "in_progress", "In progress"
    AWAITING_CUSTOMER = "awaiting_customer", "Waiting for you"
    BLOCKED = "blocked", "Blocked"
    COMPLETE = "complete", "Complete"


class Milestone(models.Model):
    """A status label and a target date. There is deliberately no percentage complete."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="milestones")
    title = models.CharField(max_length=200)
    description = models.CharField(max_length=500, blank=True)
    status = models.CharField(
        max_length=20, choices=MilestoneStatus.choices, default=MilestoneStatus.NOT_STARTED
    )
    target_date = models.DateField(null=True, blank=True)
    completed_on = models.DateField(null=True, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["position", "target_date", "id"]

    def __str__(self):
        return self.title


class Deliverable(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="deliverables")
    title = models.CharField(max_length=200)
    description = models.CharField(max_length=500, blank=True)
    milestone = models.ForeignKey(
        Milestone, null=True, blank=True, on_delete=models.SET_NULL, related_name="deliverables"
    )
    published_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.title


class DeliverableVersion(models.Model):
    """One reviewable version. Approvals attach to a version, never to the deliverable."""

    deliverable = models.ForeignKey(Deliverable, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    summary = models.CharField(max_length=300, blank=True)
    body = models.TextField(blank=True, help_text="Plain-text preview shown to the customer once shared.")
    file_version = models.ForeignKey(
        "FileVersion", null=True, blank=True, on_delete=models.SET_NULL, related_name="deliverable_versions"
    )
    requires_approval = models.BooleanField(default=True)
    # A contractual document: only an authorised signatory can record contractual acceptance of it.
    is_contractual = models.BooleanField(default=False)
    shared_at = models.DateTimeField(null=True, blank=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-number"]
        constraints = [
            models.UniqueConstraint(fields=["deliverable", "number"], name="portal_version_number")
        ]

    def __str__(self):
        return f"{self.deliverable} v{self.number}"

    @property
    def is_shared(self) -> bool:
        return self.shared_at is not None and self.withdrawn_at is None


class Approval(models.Model):
    """Who decided what about which version, and when. Review decisions and contractual acceptance are
    different records and never imply each other."""

    class Kind(models.TextChoices):
        REVIEW = "review", "Review decision"
        CONTRACTUAL = "contractual", "Contractual acceptance"

    class Decision(models.TextChoices):
        APPROVED = "approved", "Approved"
        CHANGES = "changes_requested", "Changes requested"
        ACCEPTED = "accepted", "Accepted (contractual)"

    version = models.ForeignKey(DeliverableVersion, on_delete=models.PROTECT, related_name="approvals")
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.REVIEW)
    decision = models.CharField(max_length=20, choices=Decision.choices)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")
    user_email = models.EmailField()
    user_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=12, choices=Role.choices)
    comment = models.TextField(blank=True)
    statement = models.TextField(blank=True, help_text="The exact wording shown at the moment of acceptance.")
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            # Only one approval and one contractual acceptance per version (a second attempt is refused).
            models.UniqueConstraint(
                fields=["version"],
                condition=models.Q(decision="approved"),
                name="portal_one_approval_per_version",
            ),
            models.UniqueConstraint(
                fields=["version"],
                condition=models.Q(decision="accepted"),
                name="portal_one_acceptance_per_version",
            ),
        ]

    def __str__(self):
        return f"{self.decision} on version {self.version_id}"


class ChangeStatus(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    UNDER_REVIEW = "under_review", "Under review"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"
    WITHDRAWN = "withdrawn", "Withdrawn"


class ChangeRequest(models.Model):
    """The portal can request a change to scope, cost or dates; only staff process it."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="change_requests")
    raised_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")
    title = models.CharField(max_length=200)
    description = models.TextField()
    affects = models.CharField(
        max_length=60, blank=True, help_text="scope, cost, dates or other (as chosen by the customer)"
    )
    status = models.CharField(max_length=14, choices=ChangeStatus.choices, default=ChangeStatus.SUBMITTED)
    # Shown to the customer once the staff member publishes it by setting a decision.
    customer_response = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.title


class ChangeReview(models.Model):
    """The review trail: every state change, who made it and when."""

    change = models.ForeignKey(ChangeRequest, on_delete=models.CASCADE, related_name="trail")
    from_status = models.CharField(max_length=14, blank=True)
    to_status = models.CharField(max_length=14, choices=ChangeStatus.choices)
    actor = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    actor_email = models.EmailField(blank=True)
    note = models.CharField(max_length=500, blank=True)
    customer_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.to_status} ({self.change_id})"


# --- Questions, discussion, updates ---------------------------------------------------------------------------


class InformationRequest(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Waiting for your answer"
        ANSWERED = "answered", "Answered"
        CLOSED = "closed", "Closed"

    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="information_requests")
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.SET_NULL, related_name="information_requests"
    )
    question = models.CharField(max_length=400)
    detail = models.TextField(blank=True)
    owner = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="The Vitalos person who asked.",
    )
    assigned_to = models.ForeignKey(
        Membership, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    published_at = models.DateTimeField(null=True, blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["status", "due_date", "-created_at"]

    def __str__(self):
        return self.question


class InformationResponse(models.Model):
    request = models.ForeignKey(InformationRequest, on_delete=models.CASCADE, related_name="responses")
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    # Set when a staff member opens the challenge workspace: drives the "answer not yet read" work queue item.
    staff_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Answer to {self.request_id}"


class Thread(models.Model):
    """A discussion attached to a challenge, optionally narrowed to a milestone or deliverable. Internal
    threads exist for staff and are never visible to customers."""

    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="threads")
    milestone = models.ForeignKey(
        Milestone, null=True, blank=True, on_delete=models.CASCADE, related_name="threads"
    )
    deliverable = models.ForeignKey(
        Deliverable, null=True, blank=True, on_delete=models.CASCADE, related_name="threads"
    )
    title = models.CharField(max_length=200, blank=True)
    is_internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.title or f"Thread {self.pk}"


class Message(models.Model):
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")
    author_is_staff = models.BooleanField(default=False)
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Message {self.pk}"


class Update(models.Model):
    """Staff-prepared update: a draft is invisible to the customer until a person publishes it."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="updates")
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.SET_NULL, related_name="updates"
    )
    title = models.CharField(max_length=200)
    body = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    internal_notes = models.TextField(blank=True)
    prepared_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    published_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-published_at", "-created_at", "-id"]

    def __str__(self):
        return self.title


# --- Files ------------------------------------------------------------------------------------------------------


class FileVisibility(models.TextChoices):
    CUSTOMER = "customer", "Visible to the customer"
    INTERNAL = "internal", "Internal only"


class File(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="files")
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.SET_NULL, related_name="files"
    )
    message = models.ForeignKey(
        Message, null=True, blank=True, on_delete=models.SET_NULL, related_name="files"
    )
    title = models.CharField(max_length=200)
    visibility = models.CharField(
        max_length=10, choices=FileVisibility.choices, default=FileVisibility.INTERNAL
    )
    uploaded_by_customer = models.BooleanField(default=False)
    retention_note = models.CharField(max_length=300, blank=True)
    internal_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.title


class FileVersion(models.Model):
    class Status(models.TextChoices):
        STORED = "stored", "Uploaded"
        REJECTED = "rejected", "Refused"
        UNAVAILABLE = "unavailable", "Not stored (storage not configured)"

    file = models.ForeignKey(File, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    storage_key = models.CharField(max_length=200, blank=True)
    original_name = models.CharField(max_length=200)
    content_type = models.CharField(max_length=120, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True)
    upload_status = models.CharField(max_length=12, choices=Status.choices, default=Status.STORED)
    reason = models.CharField(max_length=200, blank=True)
    uploaded_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-number"]
        constraints = [models.UniqueConstraint(fields=["file", "number"], name="portal_file_version_number")]

    def __str__(self):
        return f"{self.original_name} v{self.number}"


# --- Managed services ---------------------------------------------------------------------------------------------


class ManagedService(models.Model):
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="services")
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.SET_NULL, related_name="services"
    )
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=500, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ServiceStatusReport(models.Model):
    class Status(models.TextChoices):
        OPERATIONAL = "operational", "Operating normally"
        DEGRADED = "degraded", "Degraded"
        INCIDENT = "incident", "Incident"
        MAINTENANCE = "maintenance", "Planned maintenance"
        UNKNOWN = "unknown", "Unknown"

    class Source(models.TextChoices):
        LIVE = "live", "Live"
        DELAYED = "delayed", "Delayed"
        UNAVAILABLE = "unavailable", "Unavailable"
        MANUAL = "manual", "Manually reported by Vitalos"

    service = models.ForeignKey(ManagedService, on_delete=models.CASCADE, related_name="reports")
    status = models.CharField(max_length=12, choices=Status.choices)
    source = models.CharField(max_length=12, choices=Source.choices, default=Source.MANUAL)
    summary = models.CharField(max_length=500, blank=True)
    reported_at = models.DateTimeField(default=timezone.now)
    reported_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    published_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-reported_at", "-id"]

    def __str__(self):
        return f"{self.service_id}: {self.status}"


# --- Activity, notifications, delivery -----------------------------------------------------------------------------


class Event(models.Model):
    """Customer-safe activity feed entries, written by services when something customer-visible happens.
    ``summary`` is composed from published fields only."""

    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="events")
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.CASCADE, related_name="events"
    )
    kind = models.CharField(max_length=40)
    summary = models.CharField(max_length=300)
    actor_is_customer = models.BooleanField(default=False)
    actor_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    url_name = models.CharField(max_length=60, blank=True)
    url_kwargs = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]

    def __str__(self):
        return self.summary


class Notification(models.Model):
    class Kind(models.TextChoices):
        UPDATE = "update", "Published update"
        QUESTION = "question", "Question for you"
        DELIVERABLE = "deliverable", "Deliverable to review"
        APPROVAL = "approval", "Approval requested"
        BRIEF = "brief", "Brief to review"
        DECISION = "decision", "Decision recorded"
        MESSAGE = "message", "New message"
        CHANGE = "change", "Change request update"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="portal_notifications")
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=12, choices=Kind.choices)
    title = models.CharField(max_length=200)
    body = models.CharField(max_length=400, blank=True)
    url_name = models.CharField(max_length=60)
    url_kwargs = models.JSONField(default=dict, blank=True)
    dedupe_key = models.CharField(max_length=120)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "dedupe_key"], name="portal_notification_once")
        ]

    def __str__(self):
        return self.title


class NotificationPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="portal_preferences")
    email_updates = models.BooleanField(default=True)
    email_questions = models.BooleanField(default=True)
    email_deliverables = models.BooleanField(default=True)
    email_approvals = models.BooleanField(default=True)

    KIND_FIELD = {
        "update": "email_updates",
        "message": "email_updates",
        "brief": "email_updates",
        "decision": "email_updates",
        "change": "email_updates",
        "question": "email_questions",
        "deliverable": "email_deliverables",
        "approval": "email_approvals",
    }

    def __str__(self):
        return f"Preferences for {self.user_id}"

    def wants_email(self, kind: str) -> bool:
        return bool(getattr(self, self.KIND_FIELD.get(kind, "email_updates")))


class EmailDelivery(models.Model):
    """Durable delivery record for one portal email: queued, sent or failed, with attempts. At most one per
    notification (one per event per user). Retries are bounded and a sent record is never sent again."""

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    MAX_ATTEMPTS = 3

    notification = models.OneToOneField(
        Notification, null=True, blank=True, on_delete=models.SET_NULL, related_name="delivery"
    )
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="deliveries")
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="+")
    to_email = models.EmailField()
    kind = models.CharField(max_length=24)
    subject = models.CharField(max_length=200)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.QUEUED, db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=120, blank=True)
    next_attempt_at = models.DateTimeField(default=timezone.now)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.kind} to {self.to_email}: {self.status}"
