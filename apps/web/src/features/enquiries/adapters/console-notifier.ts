import type { EnquiryLogger, NotificationMessage, Notifier } from "../domain/ports";

/**
 * Development notifier (`EMAIL_PROVIDER=console`). It proves the outbox path end to end without a
 * mail provider and records only the reference and kind: never the enquirer's name, email or
 * goal. Production configuration rejects it. A real email adapter replaces it once a provider is
 * approved.
 */
export class ConsoleNotifier implements Notifier {
  constructor(private readonly logger: EnquiryLogger) {}

  send(message: NotificationMessage): Promise<void> {
    this.logger.info("notification.console", {
      kind: message.kind,
      reference: message.enquiry.reference,
      intent: message.enquiry.intent,
      correlationId: message.correlationId,
    });
    return Promise.resolve();
  }
}
