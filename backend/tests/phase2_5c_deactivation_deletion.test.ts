process.env.NODE_ENV = "test";
import http from "http";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";
import { filesService } from "../src/modules/files/files.service";
import { emailChangeService } from "../src/modules/users/email-change.service";
import { userService } from "../src/modules/users/user.service";

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

async function runPhase25CTests() {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.5C: Account Deactivation & Deletion");
  console.log("===============================================================");

  await ensureServerRunning();

  // Attach CSRF credentials for state-changing requests
  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_phase2_5c_suite_1234567890";
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

  const userDeact_id = "user_25c_deact";
  const userDelete_id = "user_25c_delete";
  const userTarget_id = "user_25c_target";
  const userFail_id = "user_25c_fail";
  const testPassword = "SecurePassword123!";

  const hashedPw = await bcrypt.hash(testPassword, 10);

  // Clean setup
  await prisma.emailChangeRequest.deleteMany({
    where: { userId: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
  });
  await prisma.job.deleteMany({
    where: { userId: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
  });
  await prisma.file.deleteMany({
    where: { userId: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
  });
  await prisma.document.deleteMany({
    where: { userId: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
  });

  // Create User 1 (for Deactivation tests)
  await prisma.user.create({
    data: {
      id: userDeact_id,
      name: "Deactivation User",
      email: "deact25c@example.com",
      password: hashedPw,
      isVerified: true,
      isActive: true,
    },
  });

  // Create User 2 (for Permanent Deletion tests)
  await prisma.user.create({
    data: {
      id: userDelete_id,
      name: "Deletion User",
      email: "delete25c@example.com",
      password: hashedPw,
      isVerified: true,
      isActive: true,
    },
  });

  // Create User 3 (for Authorization isolation tests)
  await prisma.user.create({
    data: {
      id: userTarget_id,
      name: "Target User",
      email: "target25c@example.com",
      password: hashedPw,
      isVerified: true,
      isActive: true,
    },
  });

  // Create User 4 (for DB Failure & Physical rollback tests)
  await prisma.user.create({
    data: {
      id: userFail_id,
      name: "Fail User",
      email: "fail25c@example.com",
      password: hashedPw,
      isVerified: true,
      isActive: true,
    },
  });

  // Sessions for Deactivation User
  const deactSession1 = await sessionService.createSession(userDeact_id);
  const deactCookie1 = `pdf_session=${deactSession1.rawToken}; pdf_csrf=${testCsrfToken}`;
  const deactSession2 = await sessionService.createSession(userDeact_id);
  const deactCookie2 = `pdf_session=${deactSession2.rawToken}; pdf_csrf=${testCsrfToken}`;

  // Sessions for Deletion User
  const deleteSession1 = await sessionService.createSession(userDelete_id);
  const deleteCookie1 = `pdf_session=${deleteSession1.rawToken}; pdf_csrf=${testCsrfToken}`;
  const deleteSession2 = await sessionService.createSession(userDelete_id);
  const deleteCookie2 = `pdf_session=${deleteSession2.rawToken}; pdf_csrf=${testCsrfToken}`;

  // Create mock physical File and Document records for Deletion User
  const uploadDir = path.resolve(process.cwd(), "uploads", "users", userDelete_id);
  fs.mkdirSync(uploadDir, { recursive: true });
  const mockStorageKey = `users/${userDelete_id}/test_file_25c.pdf`;
  const physicalFilePath = path.resolve(process.cwd(), "uploads", mockStorageKey);
  fs.writeFileSync(physicalFilePath, "%PDF-1.4 Mock file content for deletion test");

  const mockDocPath = path.resolve(process.cwd(), "uploads", "users", userDelete_id, "test_document_25c.pdf");
  fs.writeFileSync(mockDocPath, "%PDF-1.4 Mock document content for deletion test");

  await prisma.file.create({
    data: {
      id: "file_25c_delete_mock",
      userId: userDelete_id,
      originalName: "test_doc.pdf",
      storageKey: mockStorageKey,
      mimeType: "application/pdf",
      size: 100,
    },
  });

  await prisma.document.create({
    data: {
      id: "doc_25c_delete_mock",
      userId: userDelete_id,
      filename: "test_document_25c.pdf",
      originalName: "test_doc_model.pdf",
      size: 120,
      type: "UPLOAD",
      path: mockDocPath,
    },
  });

  await prisma.emailChangeRequest.create({
    data: {
      userId: userDelete_id,
      newEmail: "new_pending_delete@example.com",
      otpHash: emailChangeService.hashSecret("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    },
  });

  // Create mock physical File and Document records for Fail User
  const failUploadDir = path.resolve(process.cwd(), "uploads", "users", userFail_id);
  fs.mkdirSync(failUploadDir, { recursive: true });
  const failFileStorageKey = `users/${userFail_id}/fail_file_25c.pdf`;
  const failFilePath = path.resolve(process.cwd(), "uploads", failFileStorageKey);
  const failDocPath = path.resolve(process.cwd(), "uploads", "users", userFail_id, "fail_doc_25c.pdf");
  fs.writeFileSync(failFilePath, "%PDF-1.4 Mock fail file");
  fs.writeFileSync(failDocPath, "%PDF-1.4 Mock fail doc");

  await prisma.file.create({
    data: {
      id: "file_25c_fail_mock",
      userId: userFail_id,
      originalName: "fail_file.pdf",
      storageKey: failFileStorageKey,
      mimeType: "application/pdf",
      size: 80,
    },
  });

  await prisma.document.create({
    data: {
      id: "doc_25c_fail_mock",
      userId: userFail_id,
      filename: "fail_doc_25c.pdf",
      originalName: "fail_doc.pdf",
      size: 90,
      type: "UPLOAD",
      path: failDocPath,
    },
  });

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

  // --- SECTION 1: ACCOUNT DEACTIVATION (C1, C2, C3, C6, C7, C9) ---

  await test("POST /me/deactivate unauthenticated returns 401 UNAUTHORIZED", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: testPassword }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  await test("POST /me/deactivate with missing currentPassword returns 400 Bad Request", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: deactCookie1 },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    if (res.status !== 400 || body.success !== false) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("POST /me/deactivate with incorrect currentPassword returns 401 INVALID_CREDENTIALS", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: deactCookie1 },
      body: JSON.stringify({ currentPassword: "WrongPassword123!" }),
    });
    const body = await res.json();
    if (res.status !== 401 || body.error?.code !== "INVALID_CREDENTIALS") {
      throw new Error(`Expected 401 INVALID_CREDENTIALS, got ${res.status}: ${JSON.stringify(body)}`);
    }

    // Verify user is STILL ACTIVE
    const dbUser = await prisma.user.findUnique({ where: { id: userDeact_id } });
    if (!dbUser?.isActive) {
      throw new Error("User was unexpectedly deactivated after wrong password!");
    }
  });

  await test("POST /me/deactivate with valid password deactivates user and revokes ALL sessions", async () => {
    // Check sessions valid before deactivation
    const checkSess1 = await sessionService.validateSession(deactSession1.rawToken);
    const checkSess2 = await sessionService.validateSession(deactSession2.rawToken);
    if (!checkSess1.valid || !checkSess2.valid) {
      throw new Error("Precondition failed: Sessions were not active before deactivation!");
    }

    const res = await fetch(`${BASE_URL}/api/v1/users/me/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: deactCookie1 },
      body: JSON.stringify({ currentPassword: testPassword }),
    });
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(body)}`);
    }

    // 1. User remains in DB but isActive is FALSE (C1, C9)
    const dbUser = await prisma.user.findUnique({ where: { id: userDeact_id } });
    if (!dbUser) {
      throw new Error("User record was deleted instead of deactivated!");
    }
    if (dbUser.isActive !== false) {
      throw new Error(`Expected dbUser.isActive to be false, got: ${dbUser.isActive}`);
    }

    // 2. ALL sessions are revoked (including calling session and secondary sessions) (C3)
    const valSess1 = await sessionService.validateSession(deactSession1.rawToken);
    const valSess2 = await sessionService.validateSession(deactSession2.rawToken);
    if (valSess1.valid) {
      throw new Error("Calling session 1 was not revoked!");
    }
    if (valSess2.valid) {
      throw new Error("Secondary session 2 was not revoked!");
    }
  });

  await test("Subsequent authenticated requests on deactivated user sessions return 401 UNAUTHORIZED", async () => {
    const res1 = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Cookie: deactCookie1 },
    });
    if (res1.status !== 401) {
      throw new Error(`Expected 401 on revoked session 1, got ${res1.status}`);
    }

    const res2 = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Cookie: deactCookie2 },
    });
    if (res2.status !== 401) {
      throw new Error(`Expected 401 on revoked session 2, got ${res2.status}`);
    }
  });

  await test("POST /auth/login with deactivated account is blocked with 401 'Account is unavailable.' (C2)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "deact25c@example.com",
        password: testPassword,
      }),
    });
    const body = await res.json();
    if (res.status !== 401 || body.error?.code !== "ACCOUNT_DEACTIVATED") {
      throw new Error(`Expected 401 ACCOUNT_DEACTIVATED, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.error?.message !== "Account is unavailable.") {
      throw new Error(`Expected 'Account is unavailable.', got '${body.error?.message}'`);
    }
  });

  // --- SECTION 2: PERMANENT ACCOUNT DELETION (C4, C5, C6, C7, C8, C9) ---

  await test("DELETE /me unauthenticated returns 401 UNAUTHORIZED", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: testPassword }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  await test("DELETE /me with missing currentPassword returns 400 Bad Request", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: deleteCookie1 },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    if (res.status !== 400 || body.success !== false) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  await test("DELETE /me with wrong password returns 401 INVALID_CREDENTIALS without deleting data", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: deleteCookie1 },
      body: JSON.stringify({ currentPassword: "IncorrectPassword123!" }),
    });
    const body = await res.json();
    if (res.status !== 401 || body.error?.code !== "INVALID_CREDENTIALS") {
      throw new Error(`Expected 401 INVALID_CREDENTIALS, got ${res.status}: ${JSON.stringify(body)}`);
    }

    // Verify user and data are STILL INTACT in DB
    const dbUser = await prisma.user.findUnique({ where: { id: userDelete_id } });
    if (!dbUser) {
      throw new Error("User was unexpectedly deleted after incorrect password!");
    }
  });

  await test("If DB transaction fails during deletion, physical files (File + Document) must STILL exist", async () => {
    // Mock prisma.$transaction to simulate database failure during deletion
    const originalTx = prisma.$transaction;
    (prisma as any).$transaction = async () => {
      throw new Error("Simulated DB Transaction Failure during user deletion");
    };

    let errorCaught = false;
    try {
      await userService.deleteAccount(userFail_id, testPassword);
    } catch (err: any) {
      errorCaught = true;
      if (err.message !== "Simulated DB Transaction Failure during user deletion") {
        throw err;
      }
    } finally {
      (prisma as any).$transaction = originalTx;
    }

    if (!errorCaught) {
      throw new Error("Expected userService.deleteAccount to throw on DB transaction failure!");
    }

    // Physical files MUST still exist on disk because DB deletion failed
    if (!fs.existsSync(failFilePath)) {
      throw new Error("Physical File was prematurely unlinked before DB transaction succeeded!");
    }
    if (!fs.existsSync(failDocPath)) {
      throw new Error("Physical Document was prematurely unlinked before DB transaction succeeded!");
    }

    // DB records must still exist
    const dbUser = await prisma.user.findUnique({ where: { id: userFail_id } });
    if (!dbUser) {
      throw new Error("User record was removed despite DB transaction failure!");
    }
    const dbFiles = await prisma.file.findMany({ where: { userId: userFail_id } });
    if (dbFiles.length === 0) {
      throw new Error("File record was removed despite DB transaction failure!");
    }
    const dbDocs = await prisma.document.findMany({ where: { userId: userFail_id } });
    if (dbDocs.length === 0) {
      throw new Error("Document record was removed despite DB transaction failure!");
    }

    // Clean up fail user files physically
    if (fs.existsSync(failFilePath)) fs.unlinkSync(failFilePath);
    if (fs.existsSync(failDocPath)) fs.unlinkSync(failDocPath);
  });

  await test("DELETE /me with valid password permanently deletes user and cascades dependent records (C5, C8)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: deleteCookie1 },
      body: JSON.stringify({ currentPassword: testPassword }),
    });
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(body)}`);
    }

    // 1. Verify User is completely gone from DB (C9)
    const dbUser = await prisma.user.findUnique({ where: { id: userDelete_id } });
    if (dbUser !== null) {
      throw new Error(`User was not deleted from DB: ${JSON.stringify(dbUser)}`);
    }

    // 2. Verify Sessions are cascade deleted from DB (C5)
    const remainingSessions = await prisma.session.findMany({ where: { userId: userDelete_id } });
    if (remainingSessions.length !== 0) {
      throw new Error(`Found ${remainingSessions.length} orphan sessions after user deletion!`);
    }

    // 3. Verify Files, Documents and EmailChangeRequests are cascade deleted (C5)
    const remainingFiles = await prisma.file.findMany({ where: { userId: userDelete_id } });
    if (remainingFiles.length !== 0) {
      throw new Error(`Found ${remainingFiles.length} orphan file records!`);
    }

    const remainingDocuments = await prisma.document.findMany({ where: { userId: userDelete_id } });
    if (remainingDocuments.length !== 0) {
      throw new Error(`Found ${remainingDocuments.length} orphan document records!`);
    }

    const remainingRequests = await prisma.emailChangeRequest.findMany({ where: { userId: userDelete_id } });
    if (remainingRequests.length !== 0) {
      throw new Error(`Found ${remainingRequests.length} orphan emailChangeRequests!`);
    }

    // 4. Verify Physical files (File.storageKey + Document.path) were cleaned up from disk
    if (fs.existsSync(physicalFilePath)) {
      throw new Error("Physical File storage was not cleaned up during user deletion!");
    }
    if (fs.existsSync(mockDocPath)) {
      throw new Error("Physical Document storage was not cleaned up during user deletion!");
    }
  });

  await test("Subsequent login attempt for permanently deleted account returns 401 INVALID_CREDENTIALS", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "delete25c@example.com",
        password: testPassword,
      }),
    });
    const body = await res.json();
    if (res.status !== 401 || body.error?.code !== "INVALID_CREDENTIALS") {
      throw new Error(`Expected 401 INVALID_CREDENTIALS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // --- SECTION 3: AUTHORIZATION & ISOLATION ---

  await test("User cannot deactivate or delete another user by injecting different identity parameters", async () => {
    // User Target is active
    const targetDbBefore = await prisma.user.findUnique({ where: { id: userTarget_id } });
    if (!targetDbBefore?.isActive) {
      throw new Error("Precondition failed: target user is not active!");
    }

    // Create session for attacker
    const attackerId = "user_25c_attacker";
    await prisma.user.create({
      data: {
        id: attackerId,
        name: "Attacker",
        email: "attacker25c@example.com",
        password: hashedPw,
        isVerified: true,
        isActive: true,
      },
    });
    const attackerSession = await sessionService.createSession(attackerId);
    const attackerCookie = `pdf_session=${attackerSession.rawToken}; pdf_csrf=${testCsrfToken}`;

    // Attacker tries to deactivate with payload attempting to target another user
    const res = await fetch(`${BASE_URL}/api/v1/users/me/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: attackerCookie },
      body: JSON.stringify({
        currentPassword: testPassword,
        userId: userTarget_id,
        email: "target25c@example.com",
      }),
    });

    if (res.status !== 200) {
      throw new Error(`Expected 200 for attacker deactivation, got ${res.status}`);
    }

    // Target user must still be active and completely untouched!
    const targetDbAfter = await prisma.user.findUnique({ where: { id: userTarget_id } });
    if (!targetDbAfter || !targetDbAfter.isActive) {
      throw new Error("CRITICAL SECURITY VULNERABILITY: Target user was affected by attacker request!");
    }

    // Cleanup attacker
    await prisma.session.deleteMany({ where: { userId: attackerId } });
    await prisma.user.deleteMany({ where: { id: attackerId } });
  });

  // Cleanup
  await prisma.emailChangeRequest.deleteMany({
    where: { userId: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userDeact_id, userDelete_id, userTarget_id, userFail_id] } },
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

runPhase25CTests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
