"""Opportunistic content tick (ADR-042): when the admin serves the content API, or a signed-in page in
Insights, Careers, Content or Billing, it runs the tick in the background at most once a minute."""

from . import tick

ADMIN_PREFIXES = ("/insights/", "/careers/", "/content/", "/billing/")
API_PREFIX = "/api/content/v1/"


class OpportunisticTickMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path
        user = getattr(request, "user", None)
        signed_in = user is not None and user.is_authenticated
        if path.startswith(API_PREFIX) or (signed_in and path.startswith(ADMIN_PREFIXES)):
            if response.status_code < 500:
                tick.maybe_run_async()
        return response
