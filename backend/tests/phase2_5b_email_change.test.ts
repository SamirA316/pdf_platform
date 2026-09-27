process.env.NODE_ENV = "test";
import http from "http";
import bcrypt from "bcrypt";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";
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

async function runPhase25BTests() {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.5B: Secure Email Change");
  console.log("===============================================================");

  await ensureServerRunning();

  // Attach CSRF credentials for state-changing requests in Phase 2.5B regression
  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_phase2_5b_suite_1234567890";
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

  const userA_id = "user_25b_alice";
  const userB_id = "user_25b_bob";
  const alicePassword = "AlicePassword123!";
  const bobPassword = "BobPassword123!";

  // 1. Setup clean test users
  const hashedAlice = await bcrypt.hash(alicePassword, 10);
  const hashedBob = await bcrypt.hash(bobPassword, 10);

  await prisma.emailChangeRequest.deleteMany({
    where: { userId: { in: [userA_id, userB_id] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [userA_id, userB_id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userA_id, userB_id] } },
  });

  await prisma.user.create({
    data: {
      id: userA_id,
      name: "Alice 25B",
      email: "alice25b@example.com",
      password: hashedAlice,
      isVerified: true,
    },
  });

  await prisma.user.create({
    data: {
      id: userB_id,
      name: "Bob 25B",
      email: "bob25b@example.com",
      password: hashedBob,
      isVerified: true,
    },
  });

  // Create primary session for User A
  const aliceSession1 = await sessionService.createSession(userA_id);
  const aliceCookie1 = `pdf_session=${aliceSession1.rawToken}; pdf_csrf=${testCsrfToken}`;

  // Create additional sessions for User A (for revocation test)
  const aliceSession2 = await sessionService.createSession(userA_id);
  const aliceCookie2 = `pdf_session=${aliceSession2.rawToken}; pdf_csrf=${testCsrfToken}`;

  const aliceSession3 = await sessionService.createSession(userA_id);
  const aliceCookie3 = `pdf_session=${aliceSession3.rawToken}; pdf_csrf=${testCsrfToken}`;

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

  // --- SECTION 1: REQUEST EMAIL CHANGE (B1, B2, B6, B7, B9) ---

  await test("POST /me/email/change-request unauthenticated returns 401 UNAUTHORIZED", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/change-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "alice_new@example.com" }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  await test("POST /me/email/change-request with invalid email format returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/change-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ newEmail: "not-an-email" }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.success !== false) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("POST /me/email/change-request with same current email returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/change-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ newEmail: "ALICE25B@EXAMPLE.COM" }), // Case-insensitive normalization check
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "SAME_EMAIL") {
      throw new Error(`Expected 400 SAME_EMAIL, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("POST /me/email/change-request with other user's email is rejected with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/change-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ newEmail: "bob25b@example.com" }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "EMAIL_UNAVAILABLE") {
      throw new Error(`Expected 400 EMAIL_UNAVAILABLE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("POST /me/email/change-request with valid email creates hashed OTP and sends email", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/change-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ newEmail: "alice_updated@example.com" }),
    });
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.otp || body.code) {
      throw new Error(`Security breach: Raw OTP leaked in HTTP response!`);
    }

    // Direct database validation of storage invariants (B2 / B7)
    const record = await prisma.emailChangeRequest.findFirst({
      where: { userId: userA_id, verifiedAt: null },
    });
    if (!record) {
      throw new Error("EmailChangeRequest was not created in database!");
    }
    if (record.newEmail !== "alice_updated@example.com") {
      throw new Error(`Expected newEmail 'alice_updated@example.com', got ${record.newEmail}`);
    }
    if (!record.otpHash || record.otpHash.length !== 64) {
      throw new Error(`Expected 64-char HMAC-SHA256 hash in otpHash, got ${record.otpHash}`);
    }
    if (record.attempts !== 0) {
      throw new Error(`Expected attempts 0, got ${record.attempts}`);
    }

    // Verify User.email is NOT modified yet (B1)
    const user = await prisma.user.findUnique({ where: { id: userA_id } });
    if (user?.email !== "alice25b@example.com") {
      throw new Error(`User.email was prematurely altered to ${user?.email}`);
    }
  });

  await test("POST /me/email/change-request within 60s triggers resend cooldown 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/change-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ newEmail: "alice_updated@example.com" }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "RESEND_COOLDOWN_ACTIVE") {
      throw new Error(`Expected 400 RESEND_COOLDOWN_ACTIVE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // --- SECTION 2: VERIFICATION FAILURE MODES (B3, B7) ---

  await test("POST /me/email/verify unauthenticated returns 401 UNAUTHORIZED", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  await test("POST /me/email/verify with wrong OTP returns 400 and increments attempts", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ code: "000000" }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_CODE") {
      throw new Error(`Expected 400 INVALID_CODE, got ${res.status}: ${JSON.stringify(body)}`);
    }

    const record = await prisma.emailChangeRequest.findFirst({
      where: { userId: userA_id, verifiedAt: null },
    });
    if (record?.attempts !== 1) {
      throw new Error(`Expected attempts 1, got ${record?.attempts}`);
    }
  });

  await test("POST /me/email/verify rejects after 5 failed attempts with 400 TOO_MANY_ATTEMPTS", async () => {
    // Perform 4 more incorrect attempts to reach limit
    for (let i = 0; i < 4; i++) {
      await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
        body: JSON.stringify({ code: "000000" }),
      });
    }

    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ code: "000000" }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "TOO_MANY_ATTEMPTS") {
      throw new Error(`Expected 400 TOO_MANY_ATTEMPTS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("POST /me/email/verify rejects expired OTP with 400 CODE_EXPIRED", async () => {
    // Reset and create an expired request
    await prisma.emailChangeRequest.deleteMany({ where: { userId: userA_id } });

    const knownCode = "654321";
    const otpHash = emailChangeService.hashSecret(knownCode);

    await prisma.emailChangeRequest.create({
      data: {
        userId: userA_id,
        newEmail: "alice_expired@example.com",
        otpHash,
        expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 minute ago
        attempts: 0,
      },
    });

    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ code: knownCode }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "CODE_EXPIRED") {
      throw new Error(`Expected 400 CODE_EXPIRED, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // --- SECTION 3: ATOMIC SUCCESSFUL VERIFICATION & SESSION SECURITY (B4, B5, B10) ---

  const validOtp = "789123";
  await test("Correct OTP atomically updates email, consumes request, and revokes other sessions", async () => {
    // Set up active valid request with known OTP
    await prisma.emailChangeRequest.deleteMany({ where: { userId: userA_id } });
    const otpHash = emailChangeService.hashSecret(validOtp);

    const pendingRecord = await prisma.emailChangeRequest.create({
      data: {
        userId: userA_id,
        newEmail: "alice_final_confirmed@example.com",
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    // Verify session 2 and session 3 are currently valid
    const checkSess2 = await sessionService.validateSession(aliceSession2.rawToken);
    const checkSess3 = await sessionService.validateSession(aliceSession3.rawToken);
    if (!checkSess2.valid || !checkSess3.valid) {
      throw new Error("Precondition failed: Secondary sessions are not valid before email change!");
    }

    // Submit verification using primary session (aliceCookie1)
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ code: validOtp }),
    });
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.user.email !== "alice_final_confirmed@example.com") {
      throw new Error(`Expected returned user email 'alice_final_confirmed@example.com', got ${body.user.email}`);
    }

    // 1. Verify User.email updated in database (B4)
    const dbUser = await prisma.user.findUnique({ where: { id: userA_id } });
    if (dbUser?.email !== "alice_final_confirmed@example.com") {
      throw new Error(`User.email in DB not updated: ${dbUser?.email}`);
    }

    // 2. Verify EmailChangeRequest is marked consumed and cannot be reused (B7)
    const consumedReq = await prisma.emailChangeRequest.findUnique({ where: { id: pendingRecord.id } });
    if (!consumedReq?.verifiedAt || consumedReq.otpHash !== "CONSUMED") {
      throw new Error(`EmailChangeRequest was not properly consumed in DB: ${JSON.stringify(consumedReq)}`);
    }

    // 3. Verify Current Session (aliceSession1) remains ACTIVE (B5)
    const currentValidation = await sessionService.validateSession(aliceSession1.rawToken);
    if (!currentValidation.valid) {
      throw new Error("Current session was unexpectedly revoked!");
    }

    // 4. Verify Other Sessions (aliceSession2, aliceSession3) were REVOKED (B5)
    const sess2Validation = await sessionService.validateSession(aliceSession2.rawToken);
    const sess3Validation = await sessionService.validateSession(aliceSession3.rawToken);
    if (sess2Validation.valid || sess2Validation.reason !== "REVOKED") {
      throw new Error("Session 2 was not revoked!");
    }
    if (sess3Validation.valid || sess3Validation.reason !== "REVOKED") {
      throw new Error("Session 3 was not revoked!");
    }

    // 5. Verify GET /me immediately returns new email on current session (B10)
    const getMeRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Cookie: aliceCookie1 },
    });
    const getMeBody = await getMeRes.json();
    if (getMeRes.status !== 200 || getMeBody.user?.email !== "alice_final_confirmed@example.com") {
      throw new Error(`GET /me did not reflect new email: ${JSON.stringify(getMeBody)}`);
    }

    // 6. Verify Old Session gets 401 UNAUTHORIZED on GET /me (B10)
    const oldSessionRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Cookie: aliceCookie2 },
    });
    if (oldSessionRes.status !== 401) {
      throw new Error(`Expected 401 on revoked session, got ${oldSessionRes.status}`);
    }
  });

  await test("Attempting to reuse the same OTP code again is strictly rejected (single-use)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ code: validOtp }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "NO_PENDING_REQUEST") {
      throw new Error(`Expected 400 NO_PENDING_REQUEST, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("Sensitive fields are strictly stripped from verification response", async () => {
    // Generate fresh request & verification
    await prisma.emailChangeRequest.deleteMany({ where: { userId: userA_id } });
    const freshOtp = "445566";
    await prisma.emailChangeRequest.create({
      data: {
        userId: userA_id,
        newEmail: "alice_sanitized_check@example.com",
        otpHash: emailChangeService.hashSecret(freshOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ code: freshOtp }),
    });
    const body = await res.json();
    const user = body.user;

    const forbiddenFields = [
      "password",
      "passwordHash",
      "otp",
      "otpHash",
      "token",
      "tokenHash",
      "resetPasswordToken",
    ];

    for (const f of forbiddenFields) {
      if (f in user || f in body) {
        throw new Error(`Sensitive field '${f}' leaked in verify response!`);
      }
    }
  });

  // --- SECTION 4: ATOMICITY TEST (B4) ---

  await test("Atomicity check: if transaction fails, user email, sessions, and request remain untouched", async () => {
    const initialEmail = (await prisma.user.findUnique({ where: { id: userA_id } }))?.email;
    const initialSession = await sessionService.validateSession(aliceSession1.rawToken);

    // Create a pending request with an invalid/conflicting email that will trigger DB constraint failure inside tx
    const conflictOtp = "998877";
    const pendingReq = await prisma.emailChangeRequest.create({
      data: {
        userId: userA_id,
        newEmail: "bob25b@example.com", // Belongs to Bob, will trigger uniqueness violation if tx proceeds
        otpHash: emailChangeService.hashSecret(conflictOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    const res = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ code: conflictOtp }),
    });
    if (res.status === 200) {
      throw new Error("Expected failure on conflicting email, but got 200!");
    }

    // Verify state did not partially mutate
    const postUser = await prisma.user.findUnique({ where: { id: userA_id } });
    if (postUser?.email !== initialEmail) {
      throw new Error(`User.email was mutated despite failure: ${postUser?.email}`);
    }

    const postSession = await sessionService.validateSession(aliceSession1.rawToken);
    if (!postSession.valid) {
      throw new Error("Session state was altered despite failure!");
    }

    const postReq = await prisma.emailChangeRequest.findUnique({ where: { id: pendingReq.id } });
    if (postReq?.verifiedAt !== null || postReq?.otpHash === "CONSUMED") {
      throw new Error("Request was incorrectly marked consumed!");
    }
  });

  // --- SECTION 5: CONCURRENCY & RACE-CONDITION HARDENING ---

  await test("Concurrent verification requests with the SAME valid OTP ensure strict single-use (exactly one succeeds)", async () => {
    // 1. Reset user state & create fresh valid request
    await prisma.emailChangeRequest.deleteMany({ where: { userId: userA_id } });
    const concurrentOtp = "334455";
    const targetEmail = "alice_concurrent_test@example.com";

    const reqRecord = await prisma.emailChangeRequest.create({
      data: {
        userId: userA_id,
        newEmail: targetEmail,
        otpHash: emailChangeService.hashSecret(concurrentOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    // 2. Dispatch two simultaneous verification requests with the identical valid OTP
    const [resA, resB] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
        body: JSON.stringify({ code: concurrentOtp }),
      }),
      fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
        body: JSON.stringify({ code: concurrentOtp }),
      }),
    ]);

    const statusA = resA.status;
    const statusB = resB.status;
    const bodyA = await resA.json();
    const bodyB = await resB.json();

    const successCount = (statusA === 200 ? 1 : 0) + (statusB === 200 ? 1 : 0);
    const failureCount = (statusA === 400 ? 1 : 0) + (statusB === 400 ? 1 : 0);

    if (successCount !== 1 || failureCount !== 1) {
      throw new Error(
        `Race condition failure! Expected exactly 1 success and 1 failure, got: ` +
        `Request A (status: ${statusA}, body: ${JSON.stringify(bodyA)}), ` +
        `Request B (status: ${statusB}, body: ${JSON.stringify(bodyB)})`
      );
    }

    // Verify rejected request got an appropriate error code
    const rejectedBody = statusA === 400 ? bodyA : bodyB;
    if (!["INVALID_CODE", "NO_PENDING_REQUEST"].includes(rejectedBody.error?.code)) {
      throw new Error(`Unexpected error code on rejected concurrent request: ${JSON.stringify(rejectedBody)}`);
    }

    // Verify DB consistency
    const updatedDbUser = await prisma.user.findUnique({ where: { id: userA_id } });
    if (updatedDbUser?.email !== targetEmail) {
      throw new Error(`User.email was not updated to ${targetEmail}, found ${updatedDbUser?.email}`);
    }

    const consumedDbReq = await prisma.emailChangeRequest.findUnique({ where: { id: reqRecord.id } });
    if (!consumedDbReq?.verifiedAt || consumedDbReq.otpHash !== "CONSUMED") {
      throw new Error(`EmailChangeRequest was not cleanly consumed: ${JSON.stringify(consumedDbReq)}`);
    }
  });

  await test("Multiple concurrent wrong OTP requests do not bypass attempt limit and lock request after 5 attempts", async () => {
    // 1. Reset user state & create fresh valid request
    await prisma.emailChangeRequest.deleteMany({ where: { userId: userA_id } });
    const realOtp = "556677";
    const wrongOtp = "000000";

    const reqRecord = await prisma.emailChangeRequest.create({
      data: {
        userId: userA_id,
        newEmail: "alice_attempt_race@example.com",
        otpHash: emailChangeService.hashSecret(realOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    // 2. Dispatch 8 concurrent wrong OTP requests (more than the 5-attempt limit)
    const responses = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
          body: JSON.stringify({ code: wrongOtp }),
        })
      )
    );

    // All must be 400 Bad Request
    for (const res of responses) {
      if (res.status !== 400) {
        throw new Error(`Expected status 400 for wrong OTP, got ${res.status}`);
      }
    }

    // Inspect DB attempts count — must not exceed 5
    const dbReq = await prisma.emailChangeRequest.findUnique({ where: { id: reqRecord.id } });
    if (!dbReq || dbReq.attempts > 5) {
      throw new Error(`Attempts counter exceeded maximum allowed limit: ${dbReq?.attempts}`);
    }

    // 3. Now try with the CORRECT OTP — must be strictly rejected because attempts are exhausted
    const validAttemptRes = await fetch(`${BASE_URL}/api/v1/users/me/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie1 },
      body: JSON.stringify({ code: realOtp }),
    });

    const validAttemptBody = await validAttemptRes.json();
    if (validAttemptRes.status !== 400 || !["TOO_MANY_ATTEMPTS", "CODE_EXPIRED"].includes(validAttemptBody.error?.code)) {
      throw new Error(
        `Expected 400 TOO_MANY_ATTEMPTS or CODE_EXPIRED after limit exhaustion, got ${validAttemptRes.status}: ${JSON.stringify(validAttemptBody)}`
      );
    }
  });

  // Cleanup
  await prisma.emailChangeRequest.deleteMany({
    where: { userId: { in: [userA_id, userB_id] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [userA_id, userB_id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userA_id, userB_id] } },
  });

  if (serverInstance) {
    serverInstance.close();
  }

  console.log(`\n===============================================================`);
  console.log(`Results: ${passed}/${total} passed`);
  console.log(`===============================================================`);

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase25BTests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
