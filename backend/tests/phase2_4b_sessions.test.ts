process.env.NODE_ENV = "test";
import http from "http";
import bcrypt from "bcrypt";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";

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

async function runPhase24BTests() {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.4B: Session Management & Password Change");
  console.log("===============================================================");

  await ensureServerRunning();

  // Attach CSRF credentials for state-changing requests in Phase 2.4B regression
  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_phase2_4b_suite_1234567890";
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

  const userA_id = "user_24b_alice";
  const userB_id = "user_24b_bob";
  const alicePassword = "InitialPassword123!";
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
      name: "Alice 2.4B",
      email: "alice_24b@test.local",
      password: hashedAlice,
      isVerified: true,
    },
  });

  await prisma.user.create({
    data: {
      id: userB_id,
      name: "Bob 2.4B",
      email: "bob_24b@test.local",
      password: hashedBob,
      isVerified: true,
    },
  });

  // Create multiple sessions for Alice
  const sessionA1 = await sessionService.createSession(userA_id);
  const sessionA2 = await sessionService.createSession(userA_id);
  const sessionA3 = await sessionService.createSession(userA_id);

  // Create a session for Bob
  const sessionB1 = await sessionService.createSession(userB_id);

  // TEST 1: GET /sessions without auth -> 401

  const res1 = await fetch(`${BASE_URL}/api/v1/auth/sessions`);
  if (res1.status === 401) {
    console.log("✅ [PASS] Test 1: GET /api/v1/auth/sessions without auth returns 401");
  } else {
    throw new Error(`Test 1 Failed: Expected 401, got ${res1.status}`);
  }

  // TEST 2: GET /sessions -> only own sessions

  const res2 = await fetch(`${BASE_URL}/api/v1/auth/sessions`, {
    headers: { Authorization: `Bearer ${sessionA1.rawToken}` },
  });
  const json2 = await res2.json();
  const sessionsList = json2.sessions || json2.data?.sessions;

  if (
    res2.status === 200 &&
    Array.isArray(sessionsList) &&
    sessionsList.length === 3 &&
    sessionsList.every((s: any) => s.id !== sessionB1.session.id)
  ) {
    console.log("✅ [PASS] Test 2: GET /api/v1/auth/sessions returns only user's own active sessions");
  } else {
    throw new Error(`Test 2 Failed: Expected 3 sessions belonging to Alice, got: ${JSON.stringify(json2)}`);
  }

  // TEST 3: Current session identified properly

  const currentSession = sessionsList.find((s: any) => s.id === sessionA1.session.id);
  const otherSessionA2 = sessionsList.find((s: any) => s.id === sessionA2.session.id);
  if (currentSession?.current === true && otherSessionA2?.current === false) {
    console.log("✅ [PASS] Test 3: Current session identified with current: true, others current: false");
  } else {
    throw new Error(`Test 3 Failed: Current session flag mismatch: ${JSON.stringify(sessionsList)}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Security: Raw token and tokenHash NEVER exposed
  // ---------------------------------------------------------------------------
  const hasRawToken = sessionsList.some((s: any) => "rawToken" in s || "token" in s);
  const hasTokenHash = sessionsList.some((s: any) => "tokenHash" in s);
  if (!hasRawToken && !hasTokenHash) {
    console.log("✅ [PASS] Test 4: Security verified - No raw token or tokenHash exposed in session list");
  } else {
    throw new Error("Test 4 Failed: Sensitive token data leaked in session response!");
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Revoke another user's session -> rejected (404 Not Found)
  // ---------------------------------------------------------------------------
  const res5 = await fetch(`${BASE_URL}/api/v1/auth/sessions/${sessionB1.session.id}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionA1.rawToken}` },
  });
  if (res5.status === 404) {
    console.log("✅ [PASS] Test 5: Attempt to revoke another user's session strictly rejected (404)");
  } else {
    throw new Error(`Test 5 Failed: Expected 404, got ${res5.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Revoke own session -> success
  // ---------------------------------------------------------------------------
  const res6 = await fetch(`${BASE_URL}/api/v1/auth/sessions/${sessionA2.session.id}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionA1.rawToken}` },
  });
  const json6 = await res6.json();
  if (res6.status === 200 && json6.success === true) {
    console.log("✅ [PASS] Test 6: Revoking own specific session succeeds (200)");
  } else {
    throw new Error(`Test 6 Failed: Expected 200, got ${res6.status}: ${JSON.stringify(json6)}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Revoked session A2 rejected on subsequent auth
  // ---------------------------------------------------------------------------
  const res7 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${sessionA2.rawToken}` },
  });
  if (res7.status === 401) {
    console.log("✅ [PASS] Test 7: Revoked session cannot authenticate (Returns 401 Unauthorized)");
  } else {
    throw new Error(`Test 7 Failed: Revoked session still authenticated! Status: ${res7.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Revoking an already revoked session is idempotent
  // ---------------------------------------------------------------------------
  const res8 = await fetch(`${BASE_URL}/api/v1/auth/sessions/${sessionA2.session.id}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionA1.rawToken}` },
  });
  if (res8.status === 200) {
    console.log("✅ [PASS] Test 8: Repeated revoke request is idempotent (200)");
  } else {
    throw new Error(`Test 8 Failed: Expected idempotent 200, got ${res8.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 9: Revoke all other sessions -> current preserved, others revoked
  // ---------------------------------------------------------------------------
  const res9 = await fetch(`${BASE_URL}/api/v1/auth/sessions/revoke-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionA1.rawToken}` },
  });
  const json9 = await res9.json();
  const revokedCount = json9.revokedCount !== undefined ? json9.revokedCount : json9.data?.revokedCount;

  if (res9.status === 200 && revokedCount >= 1) {
    console.log(`✅ [PASS] Test 9: POST /sessions/revoke-all revoked ${revokedCount} other session(s)`);
  } else {
    throw new Error(`Test 9 Failed: Expected 200 with revokedCount >= 1, got ${res9.status}: ${JSON.stringify(json9)}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 10: Current session (A1) preserved
  // ---------------------------------------------------------------------------
  const res10 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${sessionA1.rawToken}` },
  });
  if (res10.status === 200) {
    console.log("✅ [PASS] Test 10: Current session remains preserved and authenticated");
  } else {
    throw new Error(`Test 10 Failed: Current session was revoked! Status: ${res10.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 11: Other session (A3) now revoked
  // ---------------------------------------------------------------------------
  const res11 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${sessionA3.rawToken}` },
  });
  if (res11.status === 401) {
    console.log("✅ [PASS] Test 11: Other session (A3) confirmed revoked (401)");
  } else {
    throw new Error(`Test 11 Failed: Other session still valid! Status: ${res11.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 12: Change password rejects unauthenticated request
  // ---------------------------------------------------------------------------
  const res12 = await fetch(`${BASE_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: alicePassword, newPassword: "NewSecretPassword123!" }),
  });
  if (res12.status === 401) {
    console.log("✅ [PASS] Test 12: Change password rejects unauthenticated request (401)");
  } else {
    throw new Error(`Test 12 Failed: Expected 401, got ${res12.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 13: Change password rejects wrong current password
  // ---------------------------------------------------------------------------
  const res13 = await fetch(`${BASE_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionA1.rawToken}`,
    },
    body: JSON.stringify({ currentPassword: "WrongPassword999!", newPassword: "NewSecretPassword123!" }),
  });
  if (res13.status === 401) {
    console.log("✅ [PASS] Test 13: Change password rejects wrong current password (401)");
  } else {
    throw new Error(`Test 13 Failed: Expected 401, got ${res13.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 14: Change password rejects weak new password (<8 chars)
  // ---------------------------------------------------------------------------
  const res14 = await fetch(`${BASE_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionA1.rawToken}`,
    },
    body: JSON.stringify({ currentPassword: alicePassword, newPassword: "weak" }),
  });
  if (res14.status === 400) {
    console.log("✅ [PASS] Test 14: Change password rejects weak password (<8 characters) (400)");
  } else {
    throw new Error(`Test 14 Failed: Expected 400, got ${res14.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 15: Change password rejects identical old & new password
  // ---------------------------------------------------------------------------
  const res15 = await fetch(`${BASE_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionA1.rawToken}`,
    },
    body: JSON.stringify({ currentPassword: alicePassword, newPassword: alicePassword }),
  });
  if (res15.status === 400) {
    console.log("✅ [PASS] Test 15: Change password rejects same old and new password (400)");
  } else {
    throw new Error(`Test 15 Failed: Expected 400, got ${res15.status}`);
  }

  // Create another secondary session for Alice right before changing password
  const sessionA4 = await sessionService.createSession(userA_id);

  // ---------------------------------------------------------------------------
  // TEST 16: Change password succeeds with valid credentials
  // ---------------------------------------------------------------------------
  const newPasswordAlice = "BrandNewPassword2026!";
  const res16 = await fetch(`${BASE_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionA1.rawToken}`,
    },
    body: JSON.stringify({ currentPassword: alicePassword, newPassword: newPasswordAlice }),
  });
  const json16 = await res16.json();
  if (res16.status === 200 && json16.success === true) {
    console.log("✅ [PASS] Test 16: Password changed successfully with 200 OK");
  } else {
    throw new Error(`Test 16 Failed: Expected 200, got ${res16.status}: ${JSON.stringify(json16)}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 17: Current session preserved after password change
  // ---------------------------------------------------------------------------
  const res17 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${sessionA1.rawToken}` },
  });
  if (res17.status === 200) {
    console.log("✅ [PASS] Test 17: Current session (A1) remains preserved and active after password change");
  } else {
    throw new Error(`Test 17 Failed: Current session was invalidated after password change! Status: ${res17.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 18: Other sessions (A4) revoked after password change
  // ---------------------------------------------------------------------------
  const res18 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${sessionA4.rawToken}` },
  });
  if (res18.status === 401) {
    console.log("✅ [PASS] Test 18: Other session (A4) strictly revoked after password change (401)");
  } else {
    throw new Error(`Test 18 Failed: Secondary session remained valid after password change! Status: ${res18.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 19: Login with old password fails (401), login with new password succeeds (200)
  // ---------------------------------------------------------------------------
  const res19a = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice_24b@test.local", password: alicePassword }),
  });
  const res19b = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice_24b@test.local", password: newPasswordAlice }),
  });
  if (res19a.status === 401 && res19b.status === 200) {
    console.log("✅ [PASS] Test 19: Old password rejected (401), new password logs in successfully (200)");
  } else {
    throw new Error(`Test 19 Failed: Old pwd status=${res19a.status}, new pwd status=${res19b.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 20: Password reset revokes ALL sessions (including previously active session)
  // ---------------------------------------------------------------------------
  // Setup password reset token on Alice
  const resetToken = "reset123456";
  const cryptoHmac = (await import("crypto")).createHmac("sha256", process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production")
    .update(resetToken)
    .digest("hex");

  await prisma.user.update({
    where: { id: userA_id },
    data: {
      resetPasswordToken: cryptoHmac,
      resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
      resetPasswordAttempts: 0,
    },
  });

  const res20 = await fetch(`${BASE_URL}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "alice_24b@test.local",
      token: resetToken,
      newPassword: "AfterResetPassword123!",
    }),
  });
  if (res20.status !== 200) {
    throw new Error(`Test 20 Reset failed: ${res20.status}`);
  }

  // Now sessionA1 must be revoked!
  const res20b = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${sessionA1.rawToken}` },
  });
  if (res20b.status === 401) {
    console.log("✅ [PASS] Test 20: Password reset successfully revoked all previous sessions (Prior session -> 401)");
  } else {
    throw new Error(`Test 20 Failed: Prior session was NOT revoked after reset-password! Status: ${res20b.status}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 21: Session service cleanup: cleanupExpiredSessions()
  // ---------------------------------------------------------------------------
  // Create an already-expired session
  await prisma.session.create({
    data: {
      userId: userB_id,
      tokenHash: "expired_token_hash_for_test",
      expiresAt: new Date(Date.now() - 10000), // in the past
    },
  });
  const cleanedCount = await sessionService.cleanupExpiredSessions(0);
  if (cleanedCount >= 1) {
    console.log(`✅ [PASS] Test 21: cleanupExpiredSessions() successfully pruned expired sessions (Cleaned: ${cleanedCount})`);
  } else {
    throw new Error(`Test 21 Failed: cleanupExpiredSessions() returned count=${cleanedCount}`);
  }

  console.log("\n===============================================================");
  console.log("🎉 ALL 21 PHASE 2.4B SECURITY & SESSION MANAGEMENT TESTS PASSED!");
  console.log("===============================================================");

  if (serverInstance) {
    serverInstance.close();
  }
}

runPhase24BTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Phase 2.4B test suite failed:", err);
    if (serverInstance) {
      serverInstance.close();
    }
    process.exit(1);
  });
