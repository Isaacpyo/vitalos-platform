# Enquiry delivery failure

Confirm the enquiry is durably stored, inspect redacted provider/outbox errors using correlation ID, stop duplicate sends, retry with bounded backoff, manually notify an authorized owner if SLA risk exists, and mark sent only after provider acknowledgement. Never ask the prospect to resubmit solely because notification email failed.
