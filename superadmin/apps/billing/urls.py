from django.urls import path, re_path

from . import views

app_name = "billing"

#: An issued invoice's number (INV-2026-0001), or draft-<id> before it is issued.
REF = r"(?P<ref>(?:[A-Z]{2,8}-\d{4}-\d{4,7}|draft-\d{1,12}))"
OPPORTUNITY_REF = r"(?P<ref>OPP-\d{4,})"

urlpatterns = [
    path("", views.invoices, name="home"),
    path("invoices/", views.invoices, name="invoices"),
    path("invoices/new/", views.invoice_new, name="invoice_new"),
    re_path(
        rf"^invoices/from-opportunity/{OPPORTUNITY_REF}/$", views.from_opportunity, name="from_opportunity"
    ),
    re_path(rf"^invoices/{REF}/$", views.invoice, name="invoice"),
    re_path(rf"^invoices/{REF}/edit/$", views.invoice_edit, name="invoice_edit"),
    re_path(rf"^invoices/{REF}/issue/$", views.invoice_issue, name="invoice_issue"),
    re_path(rf"^invoices/{REF}/void/$", views.invoice_void, name="invoice_void"),
    re_path(rf"^invoices/{REF}/payment-link/$", views.invoice_payment_link, name="invoice_payment_link"),
    re_path(rf"^invoices/{REF}/payments/$", views.invoice_record_payment, name="invoice_record_payment"),
    re_path(rf"^invoices/{REF}/document/$", views.invoice_document, name="invoice_document"),
    re_path(rf"^invoices/{REF}/summary\.txt$", views.invoice_summary, name="invoice_summary"),
    path("payments/", views.payments, name="payments"),
    path("payments/new/", views.payment_new, name="payment_new"),
    path("payments/sync/", views.payments_sync, name="payments_sync"),
    path("payments/<int:pk>/link/", views.payment_link, name="payment_link"),
    path("payments/<int:pk>/unlink/", views.payment_unlink, name="payment_unlink"),
    path("settings/", views.billing_settings, name="settings"),
]
