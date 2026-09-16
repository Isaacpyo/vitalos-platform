export interface Logger {
  info(message: string, attributes?: Record<string, unknown>): void;
  error(message: string, error: unknown, attributes?: Record<string, unknown>): void;
}
export const correlationId = (headers: Headers) =>
  headers.get("x-request-id") ?? crypto.randomUUID();
