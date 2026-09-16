import type { EnquiryInput } from "@vitalos/validation";
export interface EnquiryRecord extends EnquiryInput {
  id: string;
  receivedAt: string;
}
export interface EnquiryRepository {
  save(input: EnquiryInput): Promise<EnquiryRecord>;
}
export interface AbuseProtection {
  verify(token: string | undefined, ip: string | undefined): Promise<boolean>;
}
export async function receiveEnquiry(
  input: EnquiryInput,
  deps: { repository: EnquiryRepository; abuse: AbuseProtection; token?: string; ip?: string },
) {
  if (!(await deps.abuse.verify(deps.token, deps.ip))) throw new Error("ENQUIRY_REJECTED");
  return deps.repository.save(input);
}
