process.env.NODE_ENV = "test";
import http from "http";
import bcrypt from "bcrypt";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";
import { securityEventService } from "../src/modules/users/security-event.service";
import { emailChangeService } from "../src/modules/users/email-change.service";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;

async function ensureServerRunning(): Promise<void> {
  return new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const addr = serverInstance!.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      BASE_URL = `http://localhost:${port}`;
      resolve();
    });
  });
}

async function runPhase25DTests() {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.5D: Account Security & Activity");
  console.log("===============================================================");

  await ensureServerRunning();

  // Attach CSRF credentials for state-changing requests
  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_phase2_5d_suite_9876543210";
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const opts = init ? { ...init } : {};
    const method = (opts.method || "GET").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const headers = new Headers(opts.headers);
      if (!headers.has("X-CSRF-Token")) {
        headers.set("X-CSRF-Token", testCsrfToken);
      }
      const existingCookie = headers.get("Cookie") || "";
      if (!existingCookie.includes("pdf_csrf=")) {
        headers.set(
          "Cookie",
          existingCookie ? `${existingCookie}; pdf_csrf=${testCsrfToken}` : `pdf_csrf=${testCsrfToken}`
        );
      }
      opts.headers = headers;
    }
    return rawFetch(input, opts);
  };

  const userId_a = "user_25d_alice";
  const userId_b = "user_25d_bob";
  const userId_del = "user_25d_delete";
  const testPassword = "SecureTest25D!";
  const hashedPw = await bcrypt.hash(testPassword, 10);

  // === CLEAN SETUP ===
  await prisma.securityEvent.deleteMany({
    where: { userId: { in: [userId_a, userId_b, userId_del] } },
  });
  await prisma.emailChangeRequest.deleteMany({
    where: { userId: { in: [userId_a, userId_b, userId_del] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [userId_a, userId_b, userId_del] } },
  });
  await prisma.file.deleteMany({
    where: { userId: { in: [userId_a, userId_b, userId_del] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userId_a, userId_b, userId_del] } },
  });

  // Create test users
  await prisma.user.create({
    data: {
      id: userId_a,
      name: "Alice 25D",
      email: "alice25d@example.com",
      password: hashedPw,
      isVerified: true,
      isActive: true,
    },
  });
  await prisma.user.create({
    data: {
      id: userId_b,
      name: "Bob 25D",
      email: "bob25d@example.com",
      password: hashedPw,
      isVerified: true,
      isActive: true,
    },
  });
  await prisma.user.create({
    data: {
      id: userId_del,
      name: "Delete 25D",
      email: "delete25d@example.com",
      password: hashedPw,
      isVerified: true,
      isActive: true,
    },
  });

  const sessionA = await sessionService.createSession(userId_a);
  const cookieA = `pdf_session=${sessionA.rawToken}; pdf_csrf=${testCsrfToken}`;
  const sessionB = await sessionService.createSession(userId_b);
  const cookieB = `pdf_session=${sessionB.rawToken}; pdf_csrf=${testCsrfToken}`;
  const sessionDel = await sessionService.createSession(userId_del);
  const cookieDel = `pdf_session=${sessionDel.rawToken}; pdf_csrf=${testCsrfToken}`;

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] Test ${total}: ${name}`);
      console.error(`   Error: ${err.message}`);
    }
  }

  // ===================================================================
  // SECTION 1: Event Creation — service-level
  // ===================================================================

  await test("Security event service records LOGIN_SUCCESS correctly", async () => {
    await securityEventService.record({ userId: userId_a, type: "LOGIN_SUCCESS" });
    const events = await prisma.securityEvent.findMany({ where: { userId: userId_a, type: "LOGIN_SUCCESS" } });
    if (events.length === 0) throw new Error("LOGIN_SUCCESS event was not recorded in DB");
  });

  await test("Security event service records LOGIN_FAILED correctly", async () => {
    await securityEventService.record({ userId: userId_a, type: "LOGIN_FAILED" });
    const events = await prisma.securityEvent.findMany({ where: { userId: userId_a, type: "LOGIN_FAILED" } });
    if (events.length === 0) throw new Error("LOGIN_FAILED event was not recorded in DB");
  });

  await test("Security event service records PASSWORD_CHANGED correctly", async () => {
    await securityEventService.record({ userId: userId_a, type: "PASSWORD_CHANGED" });
    const events = await prisma.securityEvent.findMany({ where: { userId: userId_a, type: "PASSWORD_CHANGED" } });
    if (events.length === 0) throw new Error("PASSWORD_CHANGED event was not recorded in DB");
  });

  await test("Security event service records EMAIL_CHANGED correctly", async () => {
    await securityEventService.record({ userId: userId_a, type: "EMAIL_CHANGED" });
    const events = await prisma.securityEvent.findMany({ where: { userId: userId_a, type: "EMAIL_CHANGED" } });
    if (events.length === 0) throw new Error("EMAIL_CHANGED event was not recorded in DB");
  });

  await test("Security event service records LOGOUT correctly", async () => {
    await securityEventService.record({ userId: userId_a, type: "LOGOUT" });
    const events = await prisma.securityEvent.findMany({ where: { userId: userId_a, type: "LOGOUT" } });
    if (events.length === 0) throw new Error("LOGOUT event was not recorded in DB");
  });

  // ===================================================================
  // SECTION 2: Integration — login triggers LOGIN_SUCCESS / LOGIN_FAILED
  // ===================================================================

  await test("POST /auth/login with correct password records LOGIN_SUCCESS event", async () => {
    const before = await prisma.securityEvent.count({ where: { userId: userId_b, type: "LOGIN_SUCCESS" } });

    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bob25d@example.com", password: testPassword }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const after = await prisma.securityEvent.count({ where: { userId: userId_b, type: "LOGIN_SUCCESS" } });
    if (after <= before) throw new Error("LOGIN_SUCCESS event not recorded after successful login");
  });

  await test("POST /auth/login with wrong password records LOGIN_FAILED event", async () => {
    const before = await prisma.securityEvent.count({ where: { userId: userId_b, type: "LOGIN_FAILED" } });

    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bob25d@example.com", password: "WrongPassword999!" }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);

    const after = await prisma.securityEvent.count({ where: { userId: userId_b, type: "LOGIN_FAILED" } });
    if (after <= before) throw new Error("LOGIN_FAILED event not recorded after failed login");
  });

  await test("POST /auth/logout records LOGOUT event", async () => {
    const session = await sessionService.createSession(userId_b);
    const logoutCookie = `pdf_session=${session.rawToken}; pdf_csrf=${testCsrfToken}`;
    const before = await prisma.securityEvent.count({ where: { userId: userId_b, type: "LOGOUT" } });

    const res = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: logoutCookie },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const after = await prisma.securityEvent.count({ where: { userId: userId_b, type: "LOGOUT" } });
    if (after <= before) throw new Error("LOGOUT event not recorded after logout");
  });

  // ===================================================================
  // SECTION 3: API — GET /me/security-events
  // ===================================================================

  await test("GET /me/security-events unauthenticated returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/security-events`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test("GET /me/security-events authenticated returns 200 with events array", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/security-events`, {
      headers: { Cookie: cookieA },
    });
    const body = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    if (!body.success) throw new Error(`Expected success: true, got: ${JSON.stringify(body)}`);
    if (!Array.isArray(body.data.events)) throw new Error("Expected events to be an array");
  });

  await test("GET /me/security-events returns only own events (user isolation D6)", async () => {
    // Clear and seed Alice with known event count, Bob with different events
    await prisma.securityEvent.deleteMany({ where: { userId: { in: [userId_a, userId_b] } } });
    await securityEventService.record({ userId: userId_a, type: "LOGIN_SUCCESS" });
    await securityEventService.record({ userId: userId_a, type: "LOGOUT" });
    await securityEventService.record({ userId: userId_b, type: "PASSWORD_CHANGED" });

    const res = await fetch(`${BASE_URL}/api/v1/users/me/security-events`, {
      headers: { Cookie: cookieA },
    });
    const body = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const events: any[] = body.data.events;
    const hasBobEvent = events.some((e: any) => e.type === "PASSWORD_CHANGED");
    if (hasBobEvent) throw new Error("SECURITY VIOLATION: Alice sees Bob's events!");

    const hasAliceEvents = events.some((e: any) => e.type === "LOGIN_SUCCESS");
    if (!hasAliceEvents) throw new Error("Alice does not see her own events");
  });

  // ===================================================================
  // SECTION 4: Pagination
  // ===================================================================

  await test("GET /me/security-events with limit=2 returns at most 2 events", async () => {
    await prisma.securityEvent.deleteMany({ where: { userId: userId_a } });
    for (let i = 0; i < 5; i++) {
      await securityEventService.record({ userId: userId_a, type: "LOGIN_SUCCESS" });
    }

    const res = await fetch(`${BASE_URL}/api/v1/users/me/security-events?limit=2`, {
      headers: { Cookie: cookieA },
    });
    const body = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (body.data.events.length > 2) throw new Error(`Expected ≤2 events, got ${body.data.events.length}`);
  });

  await test("GET /me/security-events with limit=2 and nextCursor returns next page", async () => {
    // 5 events were seeded above
    const page1Res = await fetch(`${BASE_URL}/api/v1/users/me/security-events?limit=2`, {
      headers: { Cookie: cookieA },
    });
    const page1 = await page1Res.json();
    if (!page1.data.nextCursor) throw new Error("Expected nextCursor when more events available");

    const page2Res = await fetch(
      `${BASE_URL}/api/v1/users/me/security-events?limit=2&cursor=${page1.data.nextCursor}`,
      { headers: { Cookie: cookieA } }
    );
    const page2 = await page2Res.json();
    if (page2Res.status !== 200) throw new Error(`Expected 200 on page2, got ${page2Res.status}`);
    if (!Array.isArray(page2.data.events)) throw new Error("Expected events array on page2");

    // Verify no overlap
    const page1Ids = new Set(page1.data.events.map((e: any) => e.id));
    const overlap = page2.data.events.some((e: any) => page1Ids.has(e.id));
    if (overlap) throw new Error("Cursor pagination returned overlapping events!");
  });

  await test("GET /me/security-events with limit > 100 is rejected with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/security-events?limit=101`, {
      headers: { Cookie: cookieA },
    });
    if (res.status !== 400) throw new Error(`Expected 400 for limit=101, got ${res.status}`);
  });

  // ===================================================================
  // SECTION 5: Privacy — response must not contain sensitive fields
  // ===================================================================

  await test("Security events API response never exposes sensitive fields (D8)", async () => {
    await prisma.securityEvent.deleteMany({ where: { userId: userId_a } });
    await securityEventService.record({ userId: userId_a, type: "LOGIN_SUCCESS" });

    const res = await fetch(`${BASE_URL}/api/v1/users/me/security-events`, {
      headers: { Cookie: cookieA },
    });
    const body = await res.json();
    const events: any[] = body.data.events;
    if (events.length === 0) throw new Error("No events to inspect");

    const event = events[0];
    const forbiddenFields = [
      "password", "passwordHash", "otp", "otpHash", "tokenHash",
      "resetPasswordToken", "token", "rawToken", "sessionToken",
      "userId", // userId must not be exposed in event DTO
    ];
    for (const field of forbiddenFields) {
      if (field in event) {
        throw new Error(`Sensitive field '${field}' found in security event response!`);
      }
    }

    // Only allowed fields
    const allowedKeys = ["id", "type", "createdAt"];
    const extraKeys = Object.keys(event).filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      throw new Error(`Unexpected fields in event response: ${extraKeys.join(", ")}`);
    }
  });

  // ===================================================================
  // SECTION 6: Cascade — events deleted with user
  // ===================================================================

  await test("SecurityEvent records cascade-deleted when user is deleted", async () => {
    // Seed some events for userId_del
    await securityEventService.record({ userId: userId_del, type: "LOGIN_SUCCESS" });
    await securityEventService.record({ userId: userId_del, type: "LOGOUT" });

    const beforeCount = await prisma.securityEvent.count({ where: { userId: userId_del } });
    if (beforeCount < 2) throw new Error("Precondition: events not seeded correctly");

    // Delete the user directly in DB to verify cascade (not through API which would also record ACCOUNT_DELETED)
    await prisma.session.deleteMany({ where: { userId: userId_del } });
    await prisma.user.delete({ where: { id: userId_del } });

    const afterCount = await prisma.securityEvent.count({ where: { userId: userId_del } });
    if (afterCount !== 0) {
      throw new Error(`Expected 0 security events after user deletion, found ${afterCount}`);
    }
  });

  // ===================================================================
  // SECTION 7: Retention cleanup service (D7)
  // ===================================================================

  await test("cleanupOldEvents removes events older than retention period", async () => {
    // Manually insert an old event by updating createdAt directly
    const oldEvent = await prisma.securityEvent.create({
      data: {
        userId: userId_a,
        type: "LOGIN_SUCCESS",
        createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000), // 91 days ago
      },
    });

    const cleaned = await securityEventService.cleanupOldEvents(90);
    if (cleaned < 1) throw new Error(`Expected at least 1 event cleaned, got ${cleaned}`);

    const stillExists = await prisma.securityEvent.findUnique({ where: { id: oldEvent.id } });
    if (stillExists) throw new Error("Old event was not deleted by cleanupOldEvents");
  });

  // ===================================================================
  // SECTION 8: Security event recorded on ACCOUNT_DEACTIVATED (integration)
  // ===================================================================

  await test("POST /me/deactivate records ACCOUNT_DEACTIVATED security event", async () => {
    // Create a fresh user for deactivation
    const deactId = "user_25d_deact";
    const deactPw = await bcrypt.hash(testPassword, 10);
    await prisma.securityEvent.deleteMany({ where: { userId: deactId } });
    await prisma.session.deleteMany({ where: { userId: deactId } });
    await prisma.user.deleteMany({ where: { id: deactId } });

    await prisma.user.create({
      data: {
        id: deactId,
        name: "Deact 25D",
        email: "deact25d@example.com",
        password: deactPw,
        isVerified: true,
        isActive: true,
      },
    });
    const deactSession = await sessionService.createSession(deactId);
    const deactCookie = `pdf_session=${deactSession.rawToken}; pdf_csrf=${testCsrfToken}`;

    const before = await prisma.securityEvent.count({ where: { userId: deactId, type: "ACCOUNT_DEACTIVATED" } });

    const res = await fetch(`${BASE_URL}/api/v1/users/me/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: deactCookie },
      body: JSON.stringify({ currentPassword: testPassword }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const after = await prisma.securityEvent.count({ where: { userId: deactId, type: "ACCOUNT_DEACTIVATED" } });
    if (after <= before) throw new Error("ACCOUNT_DEACTIVATED event was not recorded");

    // Cleanup
    await prisma.securityEvent.deleteMany({ where: { userId: deactId } });
    await prisma.session.deleteMany({ where: { userId: deactId } });
    await prisma.user.deleteMany({ where: { id: deactId } });
  });

  // ===================================================================
  // CLEANUP
  // ===================================================================
  await prisma.securityEvent.deleteMany({
    where: { userId: { in: [userId_a, userId_b, userId_del] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [userId_a, userId_b, userId_del] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userId_a, userId_b, userId_del] } },
  });

  if (serverInstance) serverInstance.close();

  console.log(`\n===============================================================`);
  console.log(`Results: ${passed}/${total} passed`);
  console.log(`===============================================================`);

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase25DTests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
