const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const CUSTOMER_STORE_PATH = process.env.CUSTOMER_STORE_PATH || path.join(ROOT, ".data", "customers.json");
const DEMO_MODE = process.env.DEMO_MODE === "true";
const DEMO_ADMIN_PHONE = "88665428";
const DEMO_CUSTOMER_PHONE = "72445428";
const DEMO_PASSWORD = "GaNq123@";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (DEMO_MODE ? DEMO_PASSWORD : "");
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const customerSessions = new Map();
const customerLoginAttempts = new Map();
const publicFiles = new Map([
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/showcase.js", ["showcase.js", "text/javascript; charset=utf-8"]],
  ["/vendor/three.module.js", ["node_modules/three/build/three.module.js", "text/javascript; charset=utf-8"]],
  ["/vendor/three.core.js", ["node_modules/three/build/three.core.js", "text/javascript; charset=utf-8"]],
  ["/login.js", ["login.js", "text/javascript; charset=utf-8"]],
  ["/account.js", ["account.js", "text/javascript; charset=utf-8"]],
]);
const adminStart = "<!-- protected-admin-start -->";
const adminEnd = "<!-- protected-admin-end -->";

if (DEMO_MODE && !["127.0.0.1", "::1", "localhost"].includes(HOST)) {
  console.error("DEMO_MODE can only run on localhost. Remove DEMO_MODE or use a secure ADMIN_PASSWORD.");
  process.exit(1);
}

if (!DEMO_MODE && ADMIN_PASSWORD.length < 12) {
  console.error("Set ADMIN_PASSWORD to a value at least 12 characters long.");
  process.exit(1);
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error("PORT must be a valid TCP port.");
  process.exit(1);
}

let customerRecords;
try {
  customerRecords = loadCustomers();
  if (DEMO_MODE) {
    customerRecords = addDemoCustomer(customerRecords);
  }
} catch (error) {
  console.error("Could not load customer accounts.", error);
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

  if (request.method === "POST" && url.pathname === "/api/customer/register") {
    await handleCustomerRegister(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/customer/login") {
    await handleCustomerLogin(request, response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/customer/me") {
    const customer = getCustomerSession(request);
    sendJson(response, 200, customer
      ? {
          authenticated: true,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || "",
        }
      : { authenticated: false });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/customer/logout") {
    if (!isSameOrigin(request)) {
      sendText(response, 403, "Forbidden");
      return;
    }
    destroyCustomerSession(request, response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin") {
    if (!getSession(request)) {
      serveFile(response, "admin-login.html", "text/html; charset=utf-8");
      return;
    }
    serveAdminPage(response);
    return;
  }

  if (request.method === "GET" && ["/account", "/account.html"].includes(url.pathname)) {
    serveFile(response, "account.html", "text/html; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin-login.html") {
    serveFile(response, "admin-login.html", "text/html; charset=utf-8");
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
  if (DEMO_MODE) {
    console.warn("Local demo accounts are enabled for localhost.");
  }
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
  const providedPhone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const validDemoAdmin = DEMO_MODE
    && providedPhone === DEMO_ADMIN_PHONE
    && passwordsMatch(providedPassword, DEMO_PASSWORD);
  const validConfiguredAdmin = !DEMO_MODE && passwordsMatch(providedPassword, ADMIN_PASSWORD);
  if (!validDemoAdmin && !validConfiguredAdmin) {
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

async function handleCustomerRegister(request, response) {
  if (!isSameOrigin(request)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  const clientKey = request.socket.remoteAddress || "unknown";
  if (isRateLimited(customerLoginAttempts, clientKey, response)) {
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

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (name.length < 1 || name.length > 80 || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || password.length < 12 || password.length > 128) {
    recordFailedAttempt(customerLoginAttempts, clientKey);
    sendJson(response, 400, { error: "Invalid registration details" });
    return;
  }

  if (customerRecords.some((customer) => customer.email === email)) {
    recordFailedAttempt(customerLoginAttempts, clientKey);
    sendJson(response, 409, { error: "Account already exists" });
    return;
  }

  const customer = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  const nextCustomers = [...customerRecords, customer];

  try {
    saveCustomers(nextCustomers);
  } catch (error) {
    console.error("Could not save customer account.", error);
    sendJson(response, 500, { error: "Could not create account" });
    return;
  }

  customerRecords = nextCustomers;
  customerLoginAttempts.delete(clientKey);
  setCustomerSession(response, customer);
  sendJson(response, 201, {
    ok: true,
    name: customer.name,
    email: customer.email,
    phone: customer.phone || "",
  });
}

async function handleCustomerLogin(request, response) {
  if (!isSameOrigin(request)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  const clientKey = request.socket.remoteAddress || "unknown";
  if (isRateLimited(customerLoginAttempts, clientKey, response)) {
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

  const identifier = typeof payload.identifier === "string"
    ? payload.identifier.trim().toLowerCase()
    : typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const customer = customerRecords.find((item) => item.email === identifier || item.phone === identifier);
  if (!customer || password.length > 128 || !verifyPassword(password, customer.passwordHash)) {
    recordFailedAttempt(customerLoginAttempts, clientKey);
    sendJson(response, 401, { error: "Invalid credentials" });
    return;
  }

  customerLoginAttempts.delete(clientKey);
  setCustomerSession(response, customer);
  sendJson(response, 200, {
    ok: true,
    name: customer.name,
    email: customer.email,
    phone: customer.phone || "",
  });
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

function isRateLimited(attempts, key, response) {
  const attempt = attempts.get(key);
  if (!attempt || attempt.blockedUntil <= Date.now()) {
    return false;
  }
  sendJson(response, 429, { error: "Too many attempts" });
  return true;
}

function recordFailedAttempt(attempts, key) {
  const now = Date.now();
  const attempt = attempts.get(key);
  const inWindow = attempt && attempt.windowStartedAt > now - 15 * 60 * 1000;
  const failures = inWindow ? attempt.failures + 1 : 1;
  attempts.set(key, {
    failures,
    windowStartedAt: inWindow ? attempt.windowStartedAt : now,
    blockedUntil: failures >= 5 ? now + 15 * 60 * 1000 : 0,
  });
}

function passwordsMatch(provided, expected) {
  const providedHash = crypto.createHash("sha256").update(provided).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

function verifyPassword(password, encodedHash) {
  if (typeof encodedHash !== "string" || typeof password !== "string") {
    return false;
  }

  const [saltValue, hashValue, extra] = encodedHash.split(":");
  if (!saltValue || !hashValue || extra) {
    return false;
  }

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expectedHash = Buffer.from(hashValue, "base64url");
    if (salt.length !== 16 || expectedHash.length !== 64) {
      return false;
    }
    const actualHash = crypto.scryptSync(password, salt, expectedHash.length);
    return crypto.timingSafeEqual(actualHash, expectedHash);
  } catch (error) {
    console.error("Could not verify customer password hash.", error);
    return false;
  }
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

function setCustomerSession(response, customer) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  customerSessions.set(sessionId, {
    expiresAt: Date.now() + SESSION_TTL_MS,
    customerId: customer.id,
  });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `nomad_customer_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
  );
}

function getCustomerSession(request) {
  const cookie = request.headers.cookie || "";
  const sessionId = cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("nomad_customer_session="))
    ?.slice("nomad_customer_session=".length);
  if (!sessionId) {
    return null;
  }

  const session = customerSessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    customerSessions.delete(sessionId);
    return null;
  }

  const customer = customerRecords.find((item) => item.id === session.customerId);
  if (!customer) {
    customerSessions.delete(sessionId);
    return null;
  }
  return customer;
}

function destroyCustomerSession(request, response) {
  const cookie = request.headers.cookie || "";
  const sessionId = cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("nomad_customer_session="))
    ?.slice("nomad_customer_session=".length);
  if (sessionId) {
    customerSessions.delete(sessionId);
  }
  response.setHeader(
    "Set-Cookie",
    "nomad_customer_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
  );
}

function loadCustomers() {
  if (!fs.existsSync(CUSTOMER_STORE_PATH)) {
    return [];
  }

  const customers = JSON.parse(fs.readFileSync(CUSTOMER_STORE_PATH, "utf8"));
  if (!Array.isArray(customers)) {
    throw new Error("Customer account store must contain a JSON array.");
  }
  if (customers.some((customer) => !customer || typeof customer.id !== "string"
    || typeof customer.email !== "string" || typeof customer.name !== "string"
    || (customer.phone !== undefined && typeof customer.phone !== "string")
    || typeof customer.passwordHash !== "string")) {
    throw new Error("Customer account store contains an invalid account record.");
  }
  return customers;
}

function addDemoCustomer(customers) {
  if (customers.some((customer) => customer.phone === DEMO_CUSTOMER_PHONE)) {
    return customers;
  }

  const nextCustomers = [...customers, {
    id: crypto.randomUUID(),
    name: "Demo customer",
    email: "demo-customer@nomad.local",
    phone: DEMO_CUSTOMER_PHONE,
    passwordHash: hashPassword(DEMO_PASSWORD),
    createdAt: new Date().toISOString(),
  }];
  saveCustomers(nextCustomers);
  return nextCustomers;
}

function saveCustomers(customers) {
  const directory = path.dirname(CUSTOMER_STORE_PATH);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = `${CUSTOMER_STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(customers, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryPath, CUSTOMER_STORE_PATH);
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

function serveAdminPage(response) {
  const filePath = path.join(ROOT, "index.html");
  let html;
  try {
    html = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("Could not read the admin page.", error);
    sendText(response, 500, "Could not serve requested page");
    return;
  }
  html = html.replace(
    '<section class="admin-panel reveal" id="admin">',
    '<section class="admin-panel admin-visible reveal" id="admin">',
  );
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
