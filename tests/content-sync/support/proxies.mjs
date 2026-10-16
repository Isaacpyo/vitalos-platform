// Two pass-through proxies with an on/off switch, so a spec can make the admin unreachable for
// the website, or one website target unreachable for the admin, without stopping either server.
//
//   ADMIN_PROXY  (website reads)        -> admin
//   WEB_PROXY    (second sync target)   -> website
//   CONTROL      POST /admin/down|up, POST /web/down|up, GET /state
//
// "Down" closes the connection without a response (as an unreachable host would look to fetch).
import http from "node:http";
import { ADMIN_PORT, ADMIN_PROXY_PORT, CONTROL_PORT, WEB_PORT, WEB_PROXY_PORT } from "./env.mjs";

const state = { admin: true, web: true };

function proxy(name, listenPort, targetPort) {
  const server = http.createServer((req, res) => {
    if (!state[name]) {
      req.socket.destroy();
      return;
    }
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: targetPort,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => req.socket.destroy());
    req.pipe(upstream);
  });
  server.listen(listenPort, "127.0.0.1");
}

proxy("admin", ADMIN_PROXY_PORT, ADMIN_PORT);
proxy("web", WEB_PROXY_PORT, WEB_PORT);

http
  .createServer((req, res) => {
    const match = /^\/(admin|web)\/(down|up)$/.exec(req.url ?? "");
    if (req.method === "POST" && match) state[match[1]] = match[2] === "up";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(state));
  })
  .listen(CONTROL_PORT, "127.0.0.1");
