const sensitive = /token|secret|password|authorization|cookie/i;

export const redact = (record: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, sensitive.test(k) ? "[REDACTED]" : v]),
  );
