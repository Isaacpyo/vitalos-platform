/**
 * Fake Super Admin brief-assist endpoint for the e2e run (W6). Test-only.
 *
 *   POST /api/ai-data/brief-assist/   body: version 1, stage, description, topic, answers, visitor_ref
 *   GET  /health
 *
 * It checks the request is shaped like the contract (signed headers present, scheme v1, a hashed
 * visitor_ref, no raw IP-looking value) and answers with canned, clearly synthetic content. The
 * description can ask for a failure: "[e2e-503]", "[e2e-429]" or "[e2e-invalid]" (a 200 with an
 * unusable body). The 20 s timeout is covered by the unit tests, not here. Every stage-"questions" and stage-"brief" call is
 * counted at GET /calls so a spec can prove that nothing was sent without the opt-in.
 */
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3299);
const calls = { questions: 0, brief: 0, rejected: 0 };

const send = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health")
    return send(response, 200, { ok: true });
  if (request.method === "GET" && request.url === "/calls") return send(response, 200, calls);
  if (request.method === "POST" && request.url === "/calls/reset") {
    calls.questions = calls.brief = calls.rejected = 0;
    return send(response, 200, calls);
  }
  if (request.method !== "POST" || request.url !== "/api/ai-data/brief-assist/") {
    return send(response, 404, { error: "not-found" });
  }
  let raw = "";
  request.on("data", (chunk) => (raw += chunk));
  request.on("end", () => {
    const signature = String(request.headers["x-vitalos-signature"] ?? "");
    if (
      !request.headers["x-vitalos-key-id"] ||
      !request.headers["x-vitalos-timestamp"] ||
      !/^v1=[0-9a-f]{64}$/.test(signature)
    ) {
      calls.rejected += 1;
      return send(response, 401, { error: "unauthorised" });
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      calls.rejected += 1;
      return send(response, 400, { error: "invalid" });
    }
    if (
      body.version !== 1 ||
      !["questions", "brief"].includes(body.stage) ||
      !/^[0-9a-f]{16,64}$/.test(String(body.visitor_ref ?? ""))
    ) {
      calls.rejected += 1;
      return send(response, 400, { error: "invalid" });
    }
    calls[body.stage] += 1;
    const description = String(body.description ?? "");
    if (description.includes("[e2e-503]")) return send(response, 503, { error: "unavailable" });
    if (description.includes("[e2e-429]")) return send(response, 429, { error: "rate-limited" });
    if (description.includes("[e2e-invalid]"))
      return send(response, 200, { mode: "ai", nope: true });
    if (body.stage === "questions") {
      return send(response, 200, {
        mode: "ai",
        questions: [
          {
            id: "q1",
            question: "Which supplier statements are the hardest to match?",
            why: "It shows where the effort goes.",
            suggestions: ["Foreign currency", "Missing references"],
          },
          {
            id: "q2",
            question: "Who checks the result today?",
            why: "It shows who must trust the output.",
            suggestions: ["Finance manager", "Nobody yet"],
          },
        ],
      });
    }
    return send(response, 200, {
      mode: "ai",
      brief: {
        current_workflow: "Statements are matched against the ledger by hand (synthetic e2e text).",
        desired_outcome: "Matches are proposed and exceptions are listed (synthetic e2e text).",
        possible_automation: ["Propose matches for review", "List exceptions"],
        unknowns: ["Which ledger system is used"],
        suggested_next_step: "A short conversation about the AI Opportunity Assessment.",
      },
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`fake brief-assist listening on ${port}\n`);
});
