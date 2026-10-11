import { StatusMessage } from "@vitalos/ui";

export interface ContactAlternativeProps {
  /** `siteSettings.contactEmail`, when editors have published one. */
  contactEmail?: string | undefined;
}

/**
 * Shown instead of the form while enquiries cannot be accepted honestly: no storage backend, or
 * no published privacy notice. Personal data is never collected without a notice.
 */
export function ContactAlternative({ contactEmail }: ContactAlternativeProps) {
  return (
    <StatusMessage variant="info" title="Online enquiries are not available yet">
      {contactEmail ? (
        <p>
          You can contact us by email at{" "}
          <a
            className="font-semibold text-tone-link underline underline-offset-4"
            href={`mailto:${contactEmail}`}
          >
            {contactEmail}
          </a>
          .
        </p>
      ) : (
        <p>This page is not taking enquiries at the moment.</p>
      )}
    </StatusMessage>
  );
}
