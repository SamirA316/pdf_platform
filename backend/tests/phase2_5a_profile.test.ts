process.env.NODE_ENV = "test";
import http from "http";
import bcrypt from "bcrypt";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";
import { toPublicUser } from "../src/modules/users/user.types";

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

async function runPhase25ATests() {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.5A: User Profile Read & Update");
  console.log("===============================================================");

  await ensureServerRunning();

  // Attach CSRF credentials for state-changing requests in Phase 2.5A regression
  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_phase2_5a_suite_1234567890";
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

  const userA_id = "user_25a_alice";
  const userB_id = "user_25a_bob";
  const alicePassword = "AlicePassword123!";
  const bobPassword = "BobPassword123!";

  // 1. Setup clean test users
  const hashedAlice = await bcrypt.hash(alicePassword, 10);
  const hashedBob = await bcrypt.hash(bobPassword, 10);

  await prisma.session.deleteMany({
    where: { userId: { in: [userA_id, userB_id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userA_id, userB_id] } },
  });

  await prisma.user.create({
    data: {
      id: userA_id,
      name: "Alice Original",
      email: "alice25a@example.com",
      password: hashedAlice,
      isVerified: false,
    },
  });

  await prisma.user.create({
    data: {
      id: userB_id,
      name: "Bob Original",
      email: "bob25a@example.com",
      password: hashedBob,
      isVerified: false,
    },
  });

  // Create active session for User A
  const aliceSession = await sessionService.createSession(userA_id);
  const aliceCookie = `pdf_session=${aliceSession.rawToken}; pdf_csrf=${testCsrfToken}`;

  // Create active session for User B
  const bobSession = await sessionService.createSession(userB_id);
  const bobCookie = `pdf_session=${bobSession.rawToken}; pdf_csrf=${testCsrfToken}`;

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

  // --- SECTION 1: GET /api/v1/users/me (A1, A3, A5) ---

  await test("GET /api/v1/users/me without auth returns 401 UNAUTHORIZED", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`);
    const body = await res.json();
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.success !== false || body.error?.code !== "UNAUTHORIZED") {
      throw new Error(`Expected UNAUTHORIZED error structure, got ${JSON.stringify(body)}`);
    }
  });

  await test("GET /api/v1/users/me with invalid session token returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Cookie: "pdf_session=invalid_or_fake_token_value" },
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  await test("GET /api/v1/users/me authenticated returns 200 with sanitized profile", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Cookie: aliceCookie },
    });
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (!body.user || body.user.id !== userA_id) {
      throw new Error(`Expected user.id to be ${userA_id}, got ${JSON.stringify(body.user)}`);
    }
    if (body.user.name !== "Alice Original") {
      throw new Error(`Expected user.name to be 'Alice Original', got ${body.user.name}`);
    }
    if (body.user.email !== "alice25a@example.com") {
      throw new Error(`Expected user.email to be 'alice25a@example.com', got ${body.user.email}`);
    }
    if (!body.user.createdAt || !body.user.updatedAt) {
      throw new Error("Missing createdAt or updatedAt timestamps");
    }
  });

  await test("Response strictly does NOT contain sensitive fields (password, tokens, hashes)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Cookie: aliceCookie },
    });
    const body = await res.json();
    const user = body.user;

    const forbiddenFields = [
      "password",
      "passwordHash",
      "otp",
      "otpHash",
      "otpAttempts",
      "resetPasswordToken",
      "resetPasswordExpires",
      "resetToken",
      "resetTokenHash",
      "token",
      "tokenHash",
      "sessionToken",
    ];

    for (const field of forbiddenFields) {
      if (field in user) {
        throw new Error(`Sensitive field '${field}' leaked in user profile response!`);
      }
    }
  });

  // --- SECTION 2: PATCH /api/v1/users/me (A2, A3, A6, A8) ---

  await test("PATCH /api/v1/users/me without auth returns 401 UNAUTHORIZED", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauthenticated Rename" }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  await test("PATCH /api/v1/users/me with valid name returns 200 and updates name", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: aliceCookie,
      },
      body: JSON.stringify({ name: "Alice Wonderland" }),
    });
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.user.name !== "Alice Wonderland") {
      throw new Error(`Expected updated name 'Alice Wonderland', got ${body.user.name}`);
    }

    // Verify in database
    const dbUser = await prisma.user.findUnique({ where: { id: userA_id } });
    if (dbUser?.name !== "Alice Wonderland") {
      throw new Error(`Database record not updated: ${dbUser?.name}`);
    }
  });

  await test("PATCH /api/v1/users/me rejects empty name with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: aliceCookie,
      },
      body: JSON.stringify({ name: "" }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.success !== false) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("PATCH /api/v1/users/me rejects whitespace-only name with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: aliceCookie,
      },
      body: JSON.stringify({ name: "     " }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.success !== false) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("PATCH /api/v1/users/me rejects name exceeding 100 characters with 400", async () => {
    const longName = "A".repeat(101);
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: aliceCookie,
      },
      body: JSON.stringify({ name: longName }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.success !== false) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // --- SECTION 3: Mass Assignment Protection (A4) ---

  await test("Mass assignment test: extraneous fields (role, isVerified, email) are ignored", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: aliceCookie,
      },
      body: JSON.stringify({
        name: "Alice Security Verified",
        role: "ADMIN",
        isVerified: true,
        email: "attacker_override@example.com",
        password: "new_hacked_password",
      }),
    });
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.user.name !== "Alice Security Verified") {
      throw new Error(`Expected name updated, got ${body.user.name}`);
    }

    // Direct DB verification
    const dbUser = await prisma.user.findUnique({ where: { id: userA_id } });
    if (dbUser?.email !== "alice25a@example.com") {
      throw new Error(`Email was improperly mutated to: ${dbUser?.email}`);
    }
    if (dbUser?.isVerified !== false) {
      throw new Error(`isVerified was improperly modified to: ${dbUser?.isVerified}`);
    }
    if (dbUser?.password !== hashedAlice) {
      throw new Error("Password hash was improperly modified via profile patch!");
    }
  });

  // --- SECTION 4: Authorization & Identity Isolation (A3) ---

  await test("Authorization test: User A cannot update User B even if specifying userId in body", async () => {
    // User A attempts to overwrite User B's profile
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: aliceCookie,
      },
      body: JSON.stringify({
        name: "Bob Maliciously Overwritten",
        userId: userB_id,
      }),
    });
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    }

    // Verify User A was modified, but User B is completely untouched
    const dbUserA = await prisma.user.findUnique({ where: { id: userA_id } });
    const dbUserB = await prisma.user.findUnique({ where: { id: userB_id } });

    if (dbUserA?.name !== "Bob Maliciously Overwritten") {
      throw new Error(`Expected User A name to change, got ${dbUserA?.name}`);
    }
    if (dbUserB?.name !== "Bob Original") {
      throw new Error(`User B was illegally modified! Name is now: ${dbUserB?.name}`);
    }
  });

  // --- SECTION 5: Public DTO Mapper Unit Invariant (A5) ---

  await test("toPublicUser mapper strictly strips sensitive attributes", async () => {
    const rawUserWithSecrets = {
      id: "u123",
      name: "Secret User",
      email: "secret@example.com",
      password: "bcrypt_hash_value",
      otp: "123456",
      resetPasswordToken: "token_hash",
      sessions: [{ id: "sess_1" }],
      createdAt: new Date(),
      updatedAt: new Date(),
      extraField: "should_be_stripped",
    };

    const publicDto = toPublicUser(rawUserWithSecrets);
    const keys = Object.keys(publicDto);

    if (keys.length !== 5) {
      throw new Error(`Expected exactly 5 keys in public DTO, got: ${JSON.stringify(keys)}`);
    }
    if (!("id" in publicDto) || !("name" in publicDto) || !("email" in publicDto) || !("createdAt" in publicDto) || !("updatedAt" in publicDto)) {
      throw new Error("Missing expected public keys in DTO");
    }
    if ("password" in publicDto || "otp" in publicDto || "extraField" in publicDto) {
      throw new Error("Unexpected sensitive keys present in DTO");
    }
  });

  // Cleanup
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

runPhase25ATests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
