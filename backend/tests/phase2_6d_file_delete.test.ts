process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;

const userA = { id: "user_a_delete_test", name: "User A Delete", email: "user_a_delete@test.local" };
const userB = { id: "user_b_delete_test", name: "User B Delete", email: "user_b_delete@test.local" };

let tokenA = "";
let tokenB = "";

async function ensureServerRunning(): Promise<void> {
  return new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const addr = serverInstance!.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      BASE_URL = `http://localhost:${port}`;
      console.log(`Started Phase 2.6D in-process test server on port ${port}`);
      resolve();
    });
  });
}

async function ensureTestUsers(): Promise<void> {
  for (const u of [userA, userB]) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: u.id,
          name: u.name,
          email: u.email,
          password: "hashed_test_password_12345",
          isVerified: true,
        },
      });
    }
    u.id = user.id;
  }

  const sessionA = await sessionService.createSession(userA.id);
  tokenA = sessionA.rawToken;
  const sessionB = await sessionService.createSession(userB.id);
  tokenB = sessionB.rawToken;
}

// Wrapper for global.fetch to inject CSRF token on POST/PUT/PATCH/DELETE
const rawFetch = global.fetch;
const testCsrfToken = "csrf_token_for_phase2_6d_suite_1234567890";
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

async function cleanupTestData(): Promise<void> {
  try {
    await prisma.file.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.session.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  } catch (err) {
    console.warn("Cleanup warning:", err);
  }
}

async function runPhase2_6DTests(): Promise<void> {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.6D: File Delete & Lifecycle");
  console.log("===============================================================");

  await ensureServerRunning();
  await cleanupTestData();
  await ensureTestUsers();

  const userAUploadsDir = path.resolve(process.cwd(), "uploads", "users", userA.id);
  if (!fs.existsSync(userAUploadsDir)) {
    fs.mkdirSync(userAUploadsDir, { recursive: true });
  }
  const scratchDir = path.resolve(process.cwd(), "scratch");
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  // ---------------------------------------------------------------------------
  // TEST 1 & 2: Authentication Gatekeeping
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 1 & 2: Authentication Gatekeeping ---");

  // Test 1: Unauthenticated delete -> 401 UNAUTHORIZED
  const res1 = await fetch(`${BASE_URL}/api/v1/files/some_id`, { method: "DELETE" });
  const data1 = await res1.json();
  if (res1.status !== 401 || data1.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 1 Failed: Expected 401 UNAUTHORIZED, got ${res1.status}`);
  }
  console.log("✅ [PASS] Test 1: Unauthenticated delete returns 401 UNAUTHORIZED");

  // Test 2: Invalid/forged session token -> 401 UNAUTHORIZED
  const res2 = await fetch(`${BASE_URL}/api/v1/files/some_id`, {
    method: "DELETE",
    headers: { Authorization: "Bearer forged_session_token_xyz" },
  });
  const data2 = await res2.json();
  if (res2.status !== 401 || data2.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 2 Failed: Expected 401 UNAUTHORIZED, got ${res2.status}`);
  }
  console.log("✅ [PASS] Test 2: Forged session token returns 401 UNAUTHORIZED");

  // ---------------------------------------------------------------------------
  // TEST 3, 5, 6: Owner Deletes Own File & Verifications
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3, 5, 6: Owner Deletion & Clean Removal ---");

  const sampleFilenameA = `file_to_delete_${Date.now()}.pdf`;
  const physicalPathA = path.resolve(userAUploadsDir, sampleFilenameA);
  fs.writeFileSync(physicalPathA, Buffer.from("%PDF-1.4\nTest deletion content"));

  const fileA = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "Contract_To_Delete.pdf",
      storageKey: `users/${userA.id}/${sampleFilenameA}`,
      mimeType: "application/pdf",
      size: 50,
      status: "READY",
    },
  });

  // Test 3: Owner deletes own file -> 200 OK
  const res3 = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data3 = await res3.json();
  if (res3.status !== 200 || !data3.success) {
    throw new Error(`Test 3 Failed: Owner delete expected 200 OK, got ${res3.status}`);
  }
  console.log("✅ [PASS] Test 3: Owner deletes own file returns 200 OK with success response");

  // Test 5: DB record removed
  const dbCheckA = await prisma.file.findUnique({ where: { id: fileA.id } });
  if (dbCheckA !== null) {
    throw new Error(`Test 5 Failed: DB record was not removed after deletion!`);
  }
  console.log("✅ [PASS] Test 5: DB record verified completely removed from database");

  // Test 6: Physical file removed
  if (fs.existsSync(physicalPathA)) {
    throw new Error(`Test 6 Failed: Physical file still exists on disk after deletion!`);
  }
  console.log("✅ [PASS] Test 6: Physical disk file verified completely unlinked from filesystem");

  // ---------------------------------------------------------------------------
  // TEST 4: Other User Deletes File (IDOR Protection)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: IDOR Protection & Ownership Isolation ---");

  const fileAProtectedName = `file_protected_${Date.now()}.pdf`;
  const physicalPathAProtected = path.resolve(userAUploadsDir, fileAProtectedName);
  fs.writeFileSync(physicalPathAProtected, Buffer.from("%PDF-1.4\nUser A confidential file"));

  const fileAProtected = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "UserA_Confidential.pdf",
      storageKey: `users/${userA.id}/${fileAProtectedName}`,
      mimeType: "application/pdf",
      size: 60,
      status: "READY",
    },
  });

  // User B tries to delete User A's file -> 404 FILE_NOT_FOUND
  const res4 = await fetch(`${BASE_URL}/api/v1/files/${fileAProtected.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data4 = await res4.json();
  if (res4.status !== 404 || data4.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 4 Failed: Expected 404 FILE_NOT_FOUND for User B deleting User A file, got ${res4.status}`);
  }

  // Verify file still exists in DB and on disk
  const verifyDbStillExists = await prisma.file.findUnique({ where: { id: fileAProtected.id } });
  if (!verifyDbStillExists || !fs.existsSync(physicalPathAProtected)) {
    throw new Error(`Security Violation: User B mutated or deleted User A's file!`);
  }
  console.log("✅ [PASS] Test 4: User B cannot delete User A's file -> 404 FILE_NOT_FOUND (IDOR prevented, data intact)");

  // ---------------------------------------------------------------------------
  // TEST 7: Already Deleted File
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Already Deleted File ---");
  const res7 = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data7 = await res7.json();
  if (res7.status !== 404 || data7.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 7 Failed: Deleting already deleted file should return 404, got ${res7.status}`);
  }
  console.log("✅ [PASS] Test 7: Already deleted file returns 404 FILE_NOT_FOUND");

  // ---------------------------------------------------------------------------
  // TEST 8: Missing Physical File + Existing DB Record (Ghost Record Cleanup)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Ghost Record Cleanup (Missing Physical File) ---");
  const fileGhost = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "Ghost_Record.pdf",
      storageKey: `users/${userA.id}/non_existent_ghost_${Date.now()}.pdf`,
      mimeType: "application/pdf",
      size: 100,
      status: "READY",
    },
  });

  const res8 = await fetch(`${BASE_URL}/api/v1/files/${fileGhost.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data8 = await res8.json();
  if (res8.status !== 200 || !data8.success) {
    throw new Error(`Test 8 Failed: Expected 200 OK for ghost record cleanup, got ${res8.status}`);
  }
  const ghostDbCheck = await prisma.file.findUnique({ where: { id: fileGhost.id } });
  if (ghostDbCheck !== null) {
    throw new Error(`Test 8 Failed: Ghost DB record was not removed`);
  }
  console.log("✅ [PASS] Test 8: Missing physical file with DB record safely cleans up DB record (200 OK)");

  // ---------------------------------------------------------------------------
  // TEST 9: Physical Delete Failure -> DB Record Preserved (Blocker 1)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: Physical Delete Failure -> DB Record Preserved ---");
  const failPhysName = `fail_phys_del_${Date.now()}.pdf`;
  const failPhysPath = path.resolve(userAUploadsDir, failPhysName);
  fs.writeFileSync(failPhysPath, Buffer.from("%PDF-1.4\nPhysical failure test"));

  const fileFailPhys = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "Fail_Physical.pdf",
      storageKey: `users/${userA.id}/${failPhysName}`,
      mimeType: "application/pdf",
      size: 50,
      status: "READY",
    },
  });

  // Mock rename failure for this specific file
  const originalRename = fs.promises.rename;
  fs.promises.rename = (async (oldPath: any, newPath: any) => {
    if (String(oldPath).includes("fail_phys_del")) {
      throw new Error("EACCES: permission denied, rename");
    }
    return originalRename(oldPath, newPath);
  }) as any;

  try {
    const res9 = await fetch(`${BASE_URL}/api/v1/files/${fileFailPhys.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data9 = await res9.json();

    if (res9.status !== 500 || data9.error?.code !== "FILE_DELETE_FAILED") {
      throw new Error(`Test 9 Failed: Expected 500 FILE_DELETE_FAILED on physical failure, got ${res9.status} (${JSON.stringify(data9)})`);
    }

    // Verify DB record is PRESERVED (Blocker 1 fix verified!)
    const dbPreserved = await prisma.file.findUnique({ where: { id: fileFailPhys.id } });
    if (!dbPreserved) {
      throw new Error(`Blocker 1 Violation: DB record was deleted despite physical failure!`);
    }

    // Verify physical file is still intact
    if (!fs.existsSync(failPhysPath)) {
      throw new Error(`Test 9 Failed: Physical file was lost!`);
    }

    console.log("✅ [PASS] Test 9: Physical delete failure preserves DB record and returns 500 FILE_DELETE_FAILED");
  } finally {
    fs.promises.rename = originalRename;
    // Cleanup
    await prisma.file.delete({ where: { id: fileFailPhys.id } }).catch(() => {});
    if (fs.existsSync(failPhysPath)) fs.unlinkSync(failPhysPath);
  }

  // ---------------------------------------------------------------------------
  // TEST 10: DB Delete Failure -> Physical File Restored / Preserved (Blocker 2)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 10: DB Delete Failure -> Physical File Restored / Preserved ---");
  const failDbName = `fail_db_del_${Date.now()}.pdf`;
  const failDbPath = path.resolve(userAUploadsDir, failDbName);
  fs.writeFileSync(failDbPath, Buffer.from("%PDF-1.4\nDB failure rollback test"));

  const fileFailDb = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "Fail_DB_Rollback.pdf",
      storageKey: `users/${userA.id}/${failDbName}`,
      mimeType: "application/pdf",
      size: 50,
      status: "READY",
    },
  });

  // Mock prisma.file.delete to fail on this specific file
  const originalFileDelete = prisma.file.delete;
  prisma.file.delete = (async (args: any) => {
    if (args?.where?.id === fileFailDb.id) {
      throw new Error("P2025: Simulated database connection timeout");
    }
    return originalFileDelete(args);
  }) as any;

  try {
    const res10 = await fetch(`${BASE_URL}/api/v1/files/${fileFailDb.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data10 = await res10.json();

    if (res10.status !== 500 || data10.error?.code !== "FILE_DELETE_FAILED") {
      throw new Error(`Test 10 Failed: Expected 500 FILE_DELETE_FAILED on DB failure, got ${res10.status}`);
    }

    // Verify physical file was rolled back to original location (Blocker 2 fix verified!)
    if (!fs.existsSync(failDbPath)) {
      throw new Error(`Blocker 2 Violation: Physical file was lost/not restored after DB failure!`);
    }

    // Verify DB record still exists
    const dbStillExists = await prisma.file.findUnique({ where: { id: fileFailDb.id } });
    if (!dbStillExists) {
      throw new Error(`Test 10 Failed: DB record unexpectedly gone!`);
    }

    console.log("✅ [PASS] Test 10: DB delete failure cleanly rolls back staged physical file, preserving consistency");
  } finally {
    prisma.file.delete = originalFileDelete;
    // Cleanup
    await prisma.file.delete({ where: { id: fileFailDb.id } }).catch(() => {});
    if (fs.existsSync(failDbPath)) fs.unlinkSync(failDbPath);
  }

  // ---------------------------------------------------------------------------
  // TEST 11: Path Traversal Cannot Delete Outside Uploads
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 11: Path Traversal Cannot Delete Outside Uploads ---");
  const externalFile1 = path.resolve(scratchDir, `outside_secret_${Date.now()}.txt`);
  fs.writeFileSync(externalFile1, "CONFIDENTIAL_EXTERNAL_DATA");

  const fileTraversal = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "traversal_del.pdf",
      storageKey: `../../scratch/${path.basename(externalFile1)}`,
      mimeType: "application/pdf",
      size: 100,
      status: "READY",
    },
  });

  const res11 = await fetch(`${BASE_URL}/api/v1/files/${fileTraversal.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data11 = await res11.json();
  if (res11.status !== 404 || data11.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 11 Failed: Expected 404 FILE_NOT_FOUND for traversal delete, got ${res11.status}`);
  }

  // Verify external file is still intact
  if (!fs.existsSync(externalFile1)) {
    throw new Error(`Security Violation: External file was deleted via path traversal!`);
  }
  // Cleanup
  await prisma.file.delete({ where: { id: fileTraversal.id } }).catch(() => {});
  if (fs.existsSync(externalFile1)) fs.unlinkSync(externalFile1);
  console.log("✅ [PASS] Test 11: Path traversal cannot delete files outside uploads root (404 FILE_NOT_FOUND)");

  // ---------------------------------------------------------------------------
  // TEST 12: Symlink Cannot Delete Outside Uploads
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 12: Symlink Cannot Delete Outside Uploads ---");
  const externalTarget = path.resolve(scratchDir, `symlink_target_${Date.now()}.txt`);
  fs.writeFileSync(externalTarget, "CRITICAL_EXTERNAL_SYSTEM_TARGET");

  const symlinkName = `symlink_del_${Date.now()}.pdf`;
  const symlinkPath = path.resolve(userAUploadsDir, symlinkName);
  let symlinkCreated = false;
  try {
    fs.symlinkSync(externalTarget, symlinkPath);
    symlinkCreated = true;
  } catch {}

  if (symlinkCreated) {
    const fileSymlink = await prisma.file.create({
      data: {
        userId: userA.id,
        originalName: "symlink_del.pdf",
        storageKey: `users/${userA.id}/${symlinkName}`,
        mimeType: "application/pdf",
        size: 100,
        status: "READY",
      },
    });

    const res12 = await fetch(`${BASE_URL}/api/v1/files/${fileSymlink.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data12 = await res12.json();
    if (res12.status !== 404 || data12.error?.code !== "FILE_NOT_FOUND") {
      throw new Error(`Test 12 Failed: Expected 404 for symlink delete, got ${res12.status}`);
    }

    // Verify external target was NOT deleted!
    if (!fs.existsSync(externalTarget)) {
      throw new Error(`Security Violation: External target was deleted via symlink!`);
    }

    // Clean up
    try {
      if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
    } catch {}
    await prisma.file.delete({ where: { id: fileSymlink.id } }).catch(() => {});
    if (fs.existsSync(externalTarget)) fs.unlinkSync(externalTarget);
    console.log("✅ [PASS] Test 12: Symlink escape delete rejected with 404; external target preserved");
  }

  // ---------------------------------------------------------------------------
  // TEST 13: Zero Internal Error / Path Leakage
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 13: Zero Internal Error / Path Leakage ---");
  const res13 = await fetch(`${BASE_URL}/api/v1/files/non_existent_cuid_delete`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data13 = await res13.json();
  const serialized = JSON.stringify(data13);
  if (
    serialized.includes("storageKey") ||
    serialized.includes("userId") ||
    serialized.includes("prisma") ||
    serialized.includes("/Users/") ||
    serialized.includes("uploads")
  ) {
    throw new Error(`Security Violation: Internal paths or DB details leaked in delete error: ${serialized}`);
  }
  console.log("✅ [PASS] Test 13: Zero internal path, database error, or storageKey leakage in delete responses");

  // ---------------------------------------------------------------------------
  // TEST 14 & 15: Deleted File Cannot Subsequently Download or Read Metadata
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 14 & 15: Post-Delete Access Verification ---");

  // Test 14: Deleted file cannot subsequently download
  const res14 = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data14 = await res14.json();
  if (res14.status !== 404 || data14.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 14 Failed: Expected 404 FILE_NOT_FOUND downloading deleted file, got ${res14.status}`);
  }
  console.log("✅ [PASS] Test 14: Deleted file cannot subsequently be downloaded (404 FILE_NOT_FOUND)");

  // Test 15: Deleted file cannot subsequently read metadata
  const res15 = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data15 = await res15.json();
  if (res15.status !== 404 || data15.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 15 Failed: Expected 404 FILE_NOT_FOUND getting deleted file metadata, got ${res15.status}`);
  }
  console.log("✅ [PASS] Test 15: Deleted file cannot subsequently read metadata (404 FILE_NOT_FOUND)");

  // Clean up remaining test file
  await fetch(`${BASE_URL}/api/v1/files/${fileAProtected.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  console.log("\n===============================================================");
  console.log("🎉 ALL 15 FILE DELETE & LIFECYCLE TESTS PASSED! (100%)");
  console.log("===============================================================\n");
}

runPhase2_6DTests()
  .then(() => {
    cleanupTestData().finally(() => {
      if (serverInstance) {
        serverInstance.close();
      }
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    cleanupTestData().finally(() => {
      if (serverInstance) {
        serverInstance.close();
      }
      process.exit(1);
    });
  });
