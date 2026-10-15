import {
  RelayError,
  chatBody,
  conversationRef,
  createConversationBody,
  feedbackBody,
  handoffBody,
  uuid,
} from "@vitalos/relay-core";
import type { ChatEvent, RequestMeta } from "@vitalos/relay-core";
import { clientIpFromHeaders } from "@vitalos/security/rate-limit";
import { z } from "zod";
import type { Relay } from "../composition";
import { bearer, errorResponse, fromError, json, NO_STORE, parseBody } from "./common";

const encoder = new TextEncoder();

export function sseFrame(event: ChatEvent): Uint8Array {
  return encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

/** Wraps the chat generator as a Server-Sent Events response; client aborts stop the model. */
export function sseResponse(events: AsyncGenerator<ChatEvent>, abort: AbortController): Response {
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await events.next();
        if (next.done) controller.close();
        else controller.enqueue(sseFrame(next.value));
      } catch {
        controller.enqueue(
          sseFrame({
            event: "error",
            data: {
              code: "unavailable",
              message: "Relay can't answer right now. You can still talk to a person.",
            },
          }),
        );
        controller.close();
      }
    },
    async cancel() {
      abort.abort();
      await events.return(undefined);
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...NO_STORE,
      "content-type": "text/event-stream; charset=utf-8",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

function meta(request: Request): RequestMeta {
  return {
    ip: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get("user-agent"),
    country: request.headers.get("x-vercel-ip-country"),
  };
}

/** Same-site requests only (RELAY_ALLOWED_ORIGINS). Browsers always send Origin on POST/DELETE. */
function originAllowed(request: Request, allowed: readonly string[]): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET";
  return allowed.includes(origin);
}

const afterQuery = z.string().max(40).optional();

/**
 * Visitor API dispatcher (section 5.2). `path` is the part after /api/relay/, e.g.
 * ["conversations"], ["chat"], ["conversations", id, "messages"].
 */
export async function handleVisitorRequest(
  request: Request,
  path: readonly string[],
  relay: Relay,
): Promise<Response> {
  if (!originAllowed(request, relay.ctx.config.allowedOrigins))
    return errorResponse("forbidden_origin", 403);
  await relay.ready();
  const route = `${request.method} ${path.map((p, i) => (i === 1 && path[0] === "conversations" ? ":id" : p)).join("/")}`;
  try {
    switch (route) {
      case "POST conversations":
        return json(
          await relay.visitor.createConversation(
            await parseBody(request, createConversationBody),
            meta(request),
          ),
          201,
        );

      case "POST chat": {
        const body = await parseBody(request, chatBody);
        const abort = new AbortController();
        request.signal.addEventListener("abort", () => abort.abort(), { once: true });
        const result = await relay.visitor.chat(body, bearer(request), meta(request), abort.signal);
        if (result.kind === "accepted")
          return json({ accepted: true, visitorMessageId: result.visitorMessageId }, 202);
        return sseResponse(result.events, abort);
      }

      case "POST feedback":
        return json(
          await relay.visitor.feedback(await parseBody(request, feedbackBody), bearer(request)),
        );

      case "POST handoff":
        return json(
          await relay.visitor.handoff(await parseBody(request, handoffBody), bearer(request)),
        );

      case "POST typing": {
        const { conversationId } = await parseBody(request, conversationRef);
        await relay.visitor.typing(conversationId, bearer(request));
        return json({});
      }

      case "GET suggestions": {
        const page = new URL(request.url).searchParams.get("page") ?? "/";
        const safe = /^\/[a-z0-9/_-]{0,200}$/i.test(page) ? page : "/";
        return json({ questions: await relay.visitor.suggestions(safe) }, 200, {
          "cache-control": "public, max-age=300",
        });
      }

      case "POST resume": {
        const { token } = await parseBody(
          request,
          z.object({ token: z.string().min(20).max(100) }),
        );
        return json(await relay.visitor.resume(token));
      }

      case "GET conversations/:id/messages": {
        const id = uuid.parse(path[1]);
        const after = afterQuery.parse(new URL(request.url).searchParams.get("after") ?? undefined);
        if (after && !Number.isFinite(Date.parse(after))) throw new RelayError("invalid");
        return json(await relay.visitor.messages(id, bearer(request), after));
      }

      case "POST conversations/:id/end":
        await relay.visitor.end(uuid.parse(path[1]), bearer(request));
        return json({});

      case "DELETE conversations/:id":
        await relay.visitor.remove(uuid.parse(path[1]), bearer(request));
        return json({});

      default:
        return errorResponse("not_found", 404);
    }
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse("invalid", 400);
    return fromError(error);
  }
}
