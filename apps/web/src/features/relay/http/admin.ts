import {
  RelayError,
  adminAssignBody,
  adminIdentity,
  adminNoteBody,
  adminReplyBody,
  inboxQuery,
  knowledgeDraftBody,
  knowledgeTestBody,
  presenceBody,
  saveToKnowledgeBody,
  uuid,
  verifySignature,
} from "@vitalos/relay-core";
import type { AdminIdentity } from "@vitalos/relay-core";
import { z } from "zod";
import type { Relay } from "../composition";
import { errorResponse, fromError, json } from "./common";

const MAX_BODY = 64 * 1024;

function decodeAdmin(header: string): AdminIdentity | null {
  if (!/^[A-Za-z0-9_-]{1,2000}$/.test(header)) return null;
  try {
    const parsed = adminIdentity.safeParse(
      JSON.parse(Buffer.from(header, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function parse<S extends z.ZodType>(raw: string, schema: S): z.infer<S> {
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : {};
  } catch {
    throw new RelayError("invalid");
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new RelayError(
      "invalid",
      issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request",
    );
  }
  return result.data as z.infer<S>;
}

const forbidden = () => errorResponse("forbidden", 403, "This needs the SuperAdmin role.");

/**
 * Signed admin API (docs/relay/API.md). Every request must carry a valid HMAC over the timestamp,
 * method, path and query exactly as received, the admin identity header and the raw body.
 */
export async function handleAdminRequest(
  request: Request,
  path: readonly string[],
  relay: Relay,
  secrets: readonly string[],
): Promise<Response> {
  if (secrets.length === 0) return errorResponse("not_found", 404);
  const url = new URL(request.url);
  const rawBody =
    request.method === "GET" || request.method === "DELETE" ? "" : await request.text();
  if (rawBody.length > MAX_BODY) return errorResponse("too_long", 413);
  const adminHeader = request.headers.get("x-relay-admin") ?? "";
  const verified = verifySignature({
    secrets,
    timestamp: request.headers.get("x-relay-timestamp"),
    signature: request.headers.get("x-relay-signature"),
    method: request.method,
    pathWithQuery: url.pathname + url.search,
    adminHeader,
    body: rawBody,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!verified.ok) return json({ error: { code: verified.code, message: "Unauthorised" } }, 401);
  const admin = decodeAdmin(adminHeader);
  if (!admin)
    return json({ error: { code: "bad_signature", message: "Missing admin identity" } }, 401);
  const superAdmin = admin.role === "SuperAdmin";

  await relay.ready();
  const a = relay.admin;
  const q = url.searchParams;
  const [head, id, action] = path;
  // Only conversation ids are path parameters in the switch; knowledge ids are handled below.
  const route =
    head === "conversations"
      ? `${request.method} ${["conversations", id ? ":id" : "", action ?? ""].filter(Boolean).join("/")}`
      : `${request.method} ${path.join("/")}`;

  try {
    switch (route) {
      case "GET inbox": {
        const query = inboxQuery.parse({
          tab: q.get("tab") ?? undefined,
          q: q.get("q") ?? undefined,
          cursor: q.get("cursor") ?? undefined,
        });
        return json({ data: await a.inbox(query.tab, query.q, query.cursor) });
      }
      case "GET conversations/:id":
        return json({ data: await a.conversation(uuid.parse(id)) });
      case "GET conversations/:id/messages":
        return json({ data: await a.messagesAfter(uuid.parse(id), q.get("after") ?? undefined) });
      case "POST conversations/:id/join":
        return json({ data: await a.join(uuid.parse(id), admin) });
      case "POST conversations/:id/assign":
        return json({
          data: await a.assign(uuid.parse(id), parse(rawBody, adminAssignBody).admin),
        });
      case "POST conversations/:id/handback":
        return json({ data: await a.handback(uuid.parse(id)) });
      case "POST conversations/:id/close":
        return json({ data: await a.close(uuid.parse(id), admin) });
      case "POST conversations/:id/reply":
        return json({ data: await a.reply(uuid.parse(id), admin, parse(rawBody, adminReplyBody)) });
      case "POST conversations/:id/note":
        return json({
          data: await a.note(uuid.parse(id), admin, parse(rawBody, adminNoteBody).text),
        });
      case "POST conversations/:id/typing":
        return json({ data: await a.typing(uuid.parse(id), admin) });
      case "DELETE conversations/:id":
        return json({ data: await a.remove(uuid.parse(id), admin) });
      case "POST conversations/:id/save-to-knowledge":
        return json({
          data: await a.saveToKnowledge(
            uuid.parse(id),
            parse(rawBody, saveToKnowledgeBody).messageId,
            admin,
          ),
        });
      case "GET conversations/:id/transcript":
        return json({ data: await a.transcript(uuid.parse(id)) });

      case "POST presence":
        return json({ data: await a.presence(admin, parse(rawBody, presenceBody).available) });
      case "GET presence":
        return json({ data: await a.presenceList() });

      case "GET knowledge": {
        const source = z
          .enum(["cms", "repo", "team_answer", "faq"])
          .optional()
          .parse(q.get("source") ?? undefined);
        const status = z
          .enum(["draft", "published", "archived"])
          .optional()
          .parse(q.get("status") ?? undefined);
        const section = q.get("section") ?? undefined;
        const search = q.get("q") ?? undefined;
        return json({
          data: await a.knowledgeList({
            ...(source ? { source } : {}),
            ...(status ? { status } : {}),
            ...(section ? { section: section.slice(0, 80) } : {}),
            ...(search ? { q: search.slice(0, 120) } : {}),
          }),
        });
      }
      case "POST knowledge":
        return json({ data: await a.knowledgeCreate(parse(rawBody, knowledgeDraftBody), admin) });
      case "POST knowledge/reindex-all":
        if (!superAdmin) return forbidden();
        return json({ data: await a.knowledgeReindexAll(admin) });
      case "GET knowledge/gaps":
        return json({
          data: await a.gaps(
            z.coerce
              .number()
              .int()
              .min(1)
              .max(90)
              .catch(30)
              .parse(q.get("days") ?? 30),
          ),
        });
      case "POST knowledge/test": {
        const body = parse(rawBody, knowledgeTestBody);
        return json({ data: await a.retrievalTest(body.question, body.pagePath) });
      }
      case "GET knowledge/faq":
        return json({ data: await a.faqStatus() });
      default:
        break;
    }

    // Routes whose second segment is not a uuid.
    if (head === "knowledge" && id === "faq" && action === "sync" && request.method === "POST") {
      if (!superAdmin) return forbidden();
      const body = parse(rawBody, z.object({ full: z.boolean().optional() }));
      return json({ data: await a.faqSync(Boolean(body.full), admin) });
    }
    if (
      head === "knowledge" &&
      id === "gaps" &&
      action &&
      request.method === "POST" &&
      path[3] === "ignore"
    ) {
      return json({ data: await a.ignoreGap(uuid.parse(action)) });
    }
    if (
      head === "knowledge" &&
      id === "gaps" &&
      action &&
      request.method === "POST" &&
      path[3] === "suggest"
    ) {
      // Drafts a team answer from the best-matching page (always a draft; ADR-048).
      return json({ data: await a.suggestAnswer(uuid.parse(action), admin) });
    }
    if (head === "overview" && !id && request.method === "GET")
      return json({ data: await a.overview() });
    if (head === "knowledge" && id && uuid.safeParse(id).success) {
      const docId = uuid.parse(id);
      if (request.method === "GET" && !action) return json({ data: await a.knowledgeGet(docId) });
      if (request.method === "PATCH" && !action)
        return json({
          data: await a.knowledgeUpdate(docId, parse(rawBody, knowledgeDraftBody), admin),
        });
      if (
        request.method === "POST" &&
        (action === "publish" || action === "archive" || action === "reindex")
      ) {
        if (!superAdmin) return forbidden();
        if (action === "publish") return json({ data: await a.knowledgePublish(docId, admin) });
        if (action === "archive") return json({ data: await a.knowledgeArchive(docId, admin) });
        return json({ data: await a.knowledgeReindex(docId) });
      }
    }
    if (head === "insights" && request.method === "GET") {
      const days = z
        .union([z.literal(7), z.literal(30), z.literal(90)])
        .catch(30)
        .parse(Number(q.get("days") ?? 30));
      return json({ data: await a.insights(days) });
    }
    if (head === "settings" && !id) {
      if (request.method === "GET") return json({ data: await a.getSettings() });
      if (request.method === "PUT") {
        if (!superAdmin) return forbidden();
        const body = parse(rawBody, z.object({ settings: z.unknown() }));
        return json({ data: await a.putSettings(body.settings, admin) });
      }
    }
    if (head === "email-log" && request.method === "GET") return json({ data: await a.emailLog() });
    return errorResponse("not_found", 404);
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse("invalid", 400);
    return fromError(error);
  }
}
