import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * The narrow slice of the Supabase client the enquiry adapters use: calling a Postgres function.
 * Adapters depend on this, so tests can supply a fake without a database.
 */
export interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}

/**
 * Database failure. The message is only the SQLSTATE or a fixed label, never the driver message:
 * Postgres constraint errors embed the failing row, which here is personal data.
 */
export class EnquiryStoreError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "EnquiryStoreError";
    this.code = code;
  }
}

/** Calls a function and returns its result; throws `EnquiryStoreError` on any failure. */
export async function callRpc(
  client: RpcClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  let result: Awaited<ReturnType<RpcClient["rpc"]>>;
  try {
    result = await client.rpc(fn, args);
  } catch {
    throw new EnquiryStoreError("rpc-transport-failure");
  }
  if (result.error) throw new EnquiryStoreError(result.error.code ?? "rpc-error");
  return result.data;
}

/**
 * Server-side client using the Supabase secret (service-role style) key. It bypasses row-level
 * security by design, which is why it exists only behind `server-only` and is never exported to
 * client code. Sessions are disabled: this is not a user-facing client.
 */
export function createSupabaseRpcClient(options: { url: string; secretKey: string }): RpcClient {
  const client = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { rpc: (fn, args) => client.rpc(fn, args) };
}
