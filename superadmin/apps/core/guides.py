"""Workflow guides on Help & docs (finding F5). Written from the screens as built: every button or
label named here is the text on that screen. Update a guide when its screen changes."""

from dataclasses import dataclass

from django.urls import NoReverseMatch, reverse


@dataclass(frozen=True)
class Guide:
    slug: str
    area: str
    title: str
    intro: str
    steps: tuple[str, ...]
    url_name: str = ""
    url_query: str = ""
    link_label: str = ""
    note: str = ""

    @property
    def url(self) -> str:
        if not self.url_name:
            return ""
        try:
            base = reverse(self.url_name)
        except NoReverseMatch:
            return ""
        return f"{base}?{self.url_query}" if self.url_query else base


GUIDES = (
    Guide(
        "answer-an-enquiry",
        "Enquiries",
        "Answer an enquiry",
        "Every enquiry has a first-response target in working hours (Monday to Friday, 09:00 to 17:00 "
        "UK time). When it passes, the assignee is told, or every super admin when nobody is assigned.",
        (
            "Open Mail, then Enquiries. Start with the Overdue filter, then Unassigned.",
            "Open the enquiry and choose Assign to me (or press A), or pick a colleague under Assignee.",
            "Read the conversation. Previous enquiries from the same sender are listed in the details panel.",
            "In Reply, write your answer. Insert a canned response if one fits; your signature is added "
            "automatically.",
            "Choose Send reply, or Send and resolve when nothing more is needed. Use Internal note (N) for "
            "anything only the team should see.",
            "Set Status, Priority and Tags in the details panel as the work moves on. Resolve (E) closes it; "
            "Spam (S) removes it from the inbox.",
        ),
        "enquiries:inbox",
        "f=overdue",
        "Open overdue enquiries",
        "In log mode (local and test set-ups) replies are recorded but not sent.",
    ),
    Guide(
        "review-and-publish-an-insight",
        "Insights",
        "Review and publish an Insight",
        "A post moves Draft, In review, Approved, then Published or Scheduled. Nothing reaches the website "
        "until it is published.",
        (
            "Open Insights, then Posts. The Drafts and In review tabs show what is waiting.",
            "Open the post and write in the editor. Changes save automatically; use Preview to check the "
            "layout.",
            "When the draft is ready, choose Submit for review in Status & publishing.",
            "A reviewer with publishing rights reads it, using Preview on website where it is set up, and "
            "chooses Approve.",
            "Tick each Editorial check (authors, claims, citations, images, SEO). Each check counts only for "
            "this version: editing the post clears them.",
            "Choose Publish, or enter a date and time under Schedule (UK time) and choose Schedule. The "
            "website sync status then shows when the page is live.",
        ),
        "insights:posts",
        "tab=review",
        "Open posts in review",
        "Back to draft, Unpublish and Archive are in the same panel. Archiving a published post takes it "
        "off the website straight away.",
    ),
    Guide(
        "review-an-application",
        "Careers",
        "Review an application through its stages",
        "Stages: New, Reviewing, Interview, Offer, then Hired, Rejected or Withdrawn. Personal data is kept "
        "only as long as the retention policy allows.",
        (
            "Open Careers, then Applications. The New tab lists applications nobody has moved on yet.",
            "Open an application. Read Answers and Contact; choose Download CV if your role allows it (every "
            "download is recorded).",
            "Under Reviewer, pick who owns the review and choose Assign.",
            "Record what you think under Internal notes and choose Add note.",
            "Under Stage, pick the next stage and choose Save. Each change appears in the Timeline.",
            "Candidate emails are off while CAREERS_CANDIDATE_EMAILS_ENABLED is false: reply from your own "
            "mailbox with the Email link instead.",
        ),
        "careers:applications",
        "tab=new",
        "Open new applications",
    ),
    Guide(
        "confirm-a-faq-entry",
        "Relay",
        "Confirm a Master FAQ entry",
        "Relay uses only Verified entries from the Master FAQ in Notion. Entries that still need "
        "confirmation are listed, and Relay does not use them.",
        (
            "Open Relay, then Knowledge, then the Needs confirmation view.",
            "Read the question and its Confirm note, which says what has to be checked.",
            "Open the entry in Notion from the link next to the question, check the answer against an "
            "approved source, remove the note and set the entry to Verified.",
            "Back in Knowledge, a super admin chooses Sync now.",
            "The entry leaves Needs confirmation and Relay starts using it.",
        ),
        "relay:knowledge",
        "view=confirm",
        "Open Needs confirmation",
    ),
    Guide(
        "answer-a-gap",
        "Relay",
        "Answer a question Relay could not answer",
        "Questions Relay could not answer from published knowledge are listed as gaps, with how often they "
        "were asked in the last 30 days.",
        (
            "Open Relay, then Knowledge. Gaps are under Questions Relay couldn't answer.",
            "Choose Answer to start a new knowledge entry with the question filled in, or Add to Master FAQ "
            "when the answer belongs in the shared FAQ in Notion.",
            "Write the answer only from approved sources: the website, the Master FAQ or published Insights. "
            "Never guess a fact.",
            "Choose Save draft, then Publish. Use Test what Relay would read to check Relay now finds it.",
        ),
        "relay:knowledge",
        "",
        "Open Knowledge",
    ),
    Guide(
        "take-over-a-conversation",
        "Relay",
        "Take over a Relay conversation",
        "When a visitor asks for a person, the conversation moves to Needs a person and the team is alerted.",
        (
            "Open Relay, then Inbox, then the Needs a person tab.",
            "Open the conversation and choose Join conversation. Joining pauses Relay's AI for that "
            "conversation.",
            "Write your reply and choose Reply. If the visitor left an email address, keep Email this reply "
            "if they have left ticked so the answer reaches them.",
            "Use Assign to pass it to a colleague, and Internal note for anything only the team should see.",
            "When you are done, choose Hand back to Relay from the menu, or Close the conversation. Save "
            "reply to knowledge turns a good answer into a draft knowledge entry.",
        ),
        "relay:inbox",
        "tab=needs",
        "Open Needs a person",
    ),
)
