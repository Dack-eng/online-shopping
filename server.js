const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const publicFiles = new Map([
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/login.js", ["login.js", "text/javascript; charset=utf-8"]],
]);
const adminStart = "<!-- protected-admin-start -->";
const adminEnd = "<!-- protected-admin-end -->";

if (ADMIN_PASSWORD.length < 12) {
  console.error("Set ADMIN_PASSWORD to a value at least 12 characters long.");
  process.exit(1);
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error("PORT must be a valid TCP port.");
  process.exit(1);
}

const server = http.createServer(async (request, response) => {
  setSecurityHeaders(response);
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    await handleLogin(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/logout") {
    if (!isSameOrigin(request)) {
      sendText(response, 403, "Forbidden");
      return;
    }
    destroySession(request, response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin") {
    if (!getSession(request)) {
      serveFile(response, "admin-login.html", "text/html; charset=utf-8");
      return;
    }
    serveFile(response, "index.html", "text/html; charset=utf-8");
    return;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    servePublicStorefront(response);
    return;
  }

  if (request.method === "GET" && publicFiles.has(url.pathname)) {
    const [fileName, contentType] = publicFiles.get(url.pathname);
    serveFile(response, fileName, contentType);
    return;
  }

  sendText(response, 404, "Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Nomad Market is available at http://localhost:${PORT}`);
});

async function handleLogin(request, response) {
  if (!isSameOrigin(request)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  const clientKey = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempt = loginAttempts.get(clientKey);
  if (attempt && attempt.blockedUntil > now) {
    sendJson(response, 429, { error: "Too many attempts" });
    return;
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch {
    sendJson(response, 400, { error: "Invalid request" });
    return;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    sendJson(response, 400, { error: "Invalid request" });
    return;
  }

  const providedPassword = typeof payload.password === "string" ? payload.password : "";
  if (!passwordsMatch(providedPassword, ADMIN_PASSWORD)) {
    const failures = attempt && attempt.windowStartedAt > now - 15 * 60 * 1000
      ? attempt.failures + 1
      : 1;
    loginAttempts.set(clientKey, {
      failures,
      windowStartedAt: attempt && attempt.windowStartedAt > now - 15 * 60 * 1000
        ? attempt.windowStartedAt
        : now,
      blockedUntil: failures >= 5 ? now + 15 * 60 * 1000 : 0,
    });
    sendJson(response, failures >= 5 ? 429 : 401, { error: "Invalid credentials" });
    return;
  }

  loginAttempts.delete(clientKey);
  const sessionId = crypto.randomBytes(32).toString("base64url");
  sessions.set(sessionId, now + SESSION_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `nomad_admin_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
  );
  sendJson(response, 200, { ok: true });
}

function isSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function passwordsMatch(provided, expected) {
  const providedHash = crypto.createHash("sha256").update(provided).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

function getSession(request) {
  const cookie = request.headers.cookie || "";
  const sessionId = cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("nomad_admin_session="))
    ?.slice("nomad_admin_session=".length);
  if (!sessionId) {
    return false;
  }

  const expiresAt = sessions.get(sessionId);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

function destroySession(request, response) {
  const cookie = request.headers.cookie || "";
  const sessionId = cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("nomad_admin_session="))
    ?.slice("nomad_admin_session=".length);
  if (sessionId) {
    sessions.delete(sessionId);
  }
  response.setHeader("Set-Cookie", "nomad_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16 * 1024) {
      throw new Error("Request body too large");
    }
  }
  return JSON.parse(body);
}

function servePublicStorefront(response) {
  const filePath = path.join(ROOT, "index.html");
  let html = fs.readFileSync(filePath, "utf8");
  const start = html.indexOf(adminStart);
  const end = html.indexOf(adminEnd);
  if (start < 0 || end < start) {
    console.error("Protected admin section markers are missing from index.html.");
    sendText(response, 500, "Storefront configuration error");
    return;
  }

  html = html.slice(0, start) + html.slice(end + adminEnd.length);
  html = html.replace(/<a\b(?=[^>]*href="\/admin")[^>]*>[\s\S]*?<\/a>/gi, "");
  send(response, 200, "text/html; charset=utf-8", html);
}

function serveFile(response, fileName, contentType) {
  const filePath = path.resolve(ROOT, fileName);
  if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
    sendText(response, 404, "Not found");
    return;
  }

  let content;
  try {
    content = fs.readFileSync(filePath);
  } catch (error) {
    console.error(`Could not read ${fileName}.`, error);
    sendText(response, 500, "Could not serve requested page");
    return;
  }
  send(response, 200, contentType, content);
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'",
  );
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, statusCode, payload) {
  send(response, statusCode, "application/json; charset=utf-8", JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  send(response, statusCode, "text/plain; charset=utf-8", text);
}

function send(response, statusCode, contentType, body) {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(body);
}
