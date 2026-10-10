import "server-only";
import { getEnv } from "@vitalos/config";
import { createEnquiryService } from "./composition";
import type { EnquiryService } from "./composition";

const serviceKey = Symbol.for("vitalos.enquiries.service");
type GlobalWithService = typeof globalThis & { [serviceKey]?: EnquiryService };

/**
 * The process-wide enquiry service, built once from the validated server environment.
 * Server-only: it is constructed from secrets and must never reach a client bundle.
 */
export function getEnquiryService(): EnquiryService {
  const holder = globalThis as GlobalWithService;
  holder[serviceKey] ??= createEnquiryService(getEnv());
  return holder[serviceKey];
}
