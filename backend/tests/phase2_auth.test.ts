process.env.NODE_ENV = "test";
import crypto from "crypto";
import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { envConfig } from "../src/common/config";
import { authService } from "../src/modules/auth/auth.service";
import { sessionService } from "../src/modules/auth/session.service";
import { SESSION_COOKIE_NAME } from "../src/middlewares/auth.middleware";

let server: http.Server;
let baseUrl: string;

function hashSecret(secret: string): string {
  return crypto.createHmac("sha256", envConfig.JWT_SECRET).update(secret).digest("hex");
}

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      baseUrl = `http://localhost:${port}`;
      console.log(`Started test server on port ${port}`);
      resolve();
    });
  });
}

async function runAuthTests() {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2: Authentication & User Security");
  console.log("===============================================================");

  await startServer();

  // Attach CSRF credentials for state-changing requests in Phase 2 regression
  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_phase2_auth_suite_1234567890";
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

  try {
    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "alice_auth@test.local",
            "bob_auth@test.local",
            "charlie_auth@test.local",
            "spam_auth@test.local",
            "email_fail_user@test.local",
          ],
        },
      },
    });

    // -------------------------------------------------------------------------
    // TEST 1: Reject registration with weak password (<8 characters)
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "alice_auth@test.local",
        password: "short",
      }),
    });
    const json1 = await res1.json();
    if (res1.status === 400 && json1.error?.message?.includes("at least 8 characters")) {
      console.log("✅ [PASS] Test 1: Reject registration with weak password (<8 characters)");
    } else {
      throw new Error(`Test 1 Failed: Expected 400 weak password, got ${res1.status}: ${JSON.stringify(json1)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Reject registration with invalid email format
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "invalid-email-format",
        password: "ValidPassword123!",
      }),
    });
    const json2 = await res2.json();
    if (res2.status === 400 && json2.error?.message?.includes("valid email")) {
      console.log("✅ [PASS] Test 2: Reject registration with invalid email format");
    } else {
      throw new Error(`Test 2 Failed: Expected 400 invalid email, got ${res2.status}: ${JSON.stringify(json2)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Successful registration with valid credentials and hashed OTP in DB
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice Smith",
        email: "alice_auth@test.local",
        password: "SecurePassword123!",
      }),
    });
    const json3 = await res3.json();
    if (res3.status === 201 && json3.data?.userId) {
      // Check database to ensure OTP is hashed (64-char hex) and password is bcrypt hashed
      const userInDb = await prisma.user.findUnique({ where: { email: "alice_auth@test.local" } });
      if (!userInDb || !userInDb.otp || userInDb.otp.length !== 64 || !userInDb.password.startsWith("$2b$")) {
        throw new Error("Test 3 Failed: Plaintext OTP or weak password hashing detected in database!");
      }
      console.log("✅ [PASS] Test 3: Successful registration (Verified SHA-256 hashed OTP & bcrypt password in DB)");
    } else {
      throw new Error(`Test 3 Failed: Expected 201 registered, got ${res3.status}: ${JSON.stringify(json3)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Reject registration with duplicate verified email
    // -------------------------------------------------------------------------
    await prisma.user.create({
      data: {
        id: "bob_verified_id",
        name: "Bob Verified",
        email: "bob_auth@test.local",
        password: "HashedPassword123!",
        isVerified: true,
      },
    });

    const res4 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bob Impostor",
        email: "bob_auth@test.local",
        password: "NewPassword123!",
      }),
    });
    const json4 = await res4.json();
    if (res4.status === 409) {
      console.log("✅ [PASS] Test 4: Reject registration with duplicate verified email (409 Conflict)");
    } else {
      throw new Error(`Test 4 Failed: Expected 409 Conflict, got ${res4.status}: ${JSON.stringify(json4)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Reject login for unverified user (alice_auth@test.local)
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        password: "SecurePassword123!",
      }),
    });
    const json5 = await res5.json();
    if (res5.status === 401 && json5.error?.code === "UNVERIFIED_EMAIL") {
      console.log("✅ [PASS] Test 5: Reject login for unverified user with UNVERIFIED_EMAIL code");
    } else {
      throw new Error(`Test 5 Failed: Expected 401 UNVERIFIED_EMAIL, got ${res5.status}: ${JSON.stringify(json5)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Reject OTP verification with wrong code and track attempts
    // -------------------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/api/v1/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        otp: "000000",
      }),
    });
    const json6 = await res6.json();
    const userAfterWrongOtp = await prisma.user.findUnique({ where: { email: "alice_auth@test.local" } });
    if (res6.status === 400 && userAfterWrongOtp?.otpAttempts === 1) {
      console.log("✅ [PASS] Test 6: Reject wrong OTP and track attempt count (otpAttempts = 1)");
    } else {
      throw new Error(`Test 6 Failed: Expected 400 and attempts=1, got ${res6.status}: ${JSON.stringify(json6)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Invalidate OTP after 5 failed attempts
    // -------------------------------------------------------------------------
    for (let i = 2; i <= 4; i++) {
      await fetch(`${baseUrl}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice_auth@test.local", otp: "000000" }),
      });
    }

    const res7 = await fetch(`${baseUrl}/api/v1/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice_auth@test.local", otp: "000000" }),
    });
    const json7 = await res7.json();
    const userAfter5Attempts = await prisma.user.findUnique({ where: { email: "alice_auth@test.local" } });
    if (res7.status === 400 && json7.error?.message?.includes("invalidated") && userAfter5Attempts?.otp === null) {
      console.log("✅ [PASS] Test 7: Invalidate OTP after 5 failed attempts (brute-force protection)");
    } else {
      throw new Error(`Test 7 Failed: Expected OTP invalidation on 5th attempt, got ${res7.status}: ${JSON.stringify(json7)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Reject resend-otp if cooldown (60s) has not elapsed
    // -------------------------------------------------------------------------
    await prisma.user.update({
      where: { email: "alice_auth@test.local" },
      data: { otpLastSentAt: new Date() },
    });

    const res8 = await fetch(`${baseUrl}/api/v1/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice_auth@test.local" }),
    });
    const json8 = await res8.json();
    if (res8.status === 400 && json8.error?.message?.includes("Please wait")) {
      console.log("✅ [PASS] Test 8: Reject resend-otp during 60-second cooldown period");
    } else {
      throw new Error(`Test 8 Failed: Expected 400 cooldown, got ${res8.status}: ${JSON.stringify(json8)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Successfully resend OTP after cooldown
    // -------------------------------------------------------------------------
    await prisma.user.update({
      where: { email: "alice_auth@test.local" },
      data: { otpLastSentAt: new Date(Date.now() - 70000) }, // 70 seconds ago
    });

    const res9 = await fetch(`${baseUrl}/api/v1/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice_auth@test.local" }),
    });
    const json9 = await res9.json();
    if (res9.status === 200 && json9.data?.cooldownSeconds === 60) {
      console.log("✅ [PASS] Test 9: Successfully resend new OTP after cooldown expires");
    } else {
      throw new Error(`Test 9 Failed: Expected 200, got ${res9.status}: ${JSON.stringify(json9)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Reject OTP verification when expired
    // -------------------------------------------------------------------------
    const knownOtp = "789123";
    await prisma.user.update({
      where: { email: "alice_auth@test.local" },
      data: {
        otp: hashSecret(knownOtp),
        otpExpires: new Date(Date.now() - 5000), // Expired 5 seconds ago
        otpAttempts: 0,
      },
    });

    const res10 = await fetch(`${baseUrl}/api/v1/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice_auth@test.local", otp: knownOtp }),
    });
    const json10 = await res10.json();
    if (res10.status === 400 && json10.error?.message?.includes("expired")) {
      console.log("✅ [PASS] Test 10: Reject expired OTP code");
    } else {
      throw new Error(`Test 10 Failed: Expected 400 expired, got ${res10.status}: ${JSON.stringify(json10)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Successful OTP verification with valid code & HttpOnly cookie
    // -------------------------------------------------------------------------
    const validOtp = "654321";
    await prisma.user.update({
      where: { email: "alice_auth@test.local" },
      data: {
        otp: hashSecret(validOtp),
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
      },
    });

    const res11 = await fetch(`${baseUrl}/api/v1/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice_auth@test.local", otp: validOtp }),
    });
    const json11 = await res11.json();
    const setCookieHeader = res11.headers.get("set-cookie") || "";
    if (res11.status === 200 && json11.data?.user?.isVerified === true && setCookieHeader.includes("token=")) {
      console.log("✅ [PASS] Test 11: Successful OTP verification (Set isVerified=true & set HttpOnly cookie)");
    } else {
      throw new Error(`Test 11 Failed: Expected 200 with cookie, got ${res11.status}: ${JSON.stringify(json11)}`);
    }

    const aliceToken = json11.data.token;

    // -------------------------------------------------------------------------
    // TEST 12: Successful login with verified user
    // -------------------------------------------------------------------------
    const res12 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        password: "SecurePassword123!",
      }),
    });
    const json12 = await res12.json();
    if (res12.status === 200 && json12.data?.user?.email === "alice_auth@test.local") {
      console.log("✅ [PASS] Test 12: Successful login for verified user");
    } else {
      throw new Error(`Test 12 Failed: Expected 200, got ${res12.status}: ${JSON.stringify(json12)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Reject login with wrong password
    // -------------------------------------------------------------------------
    const res13 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        password: "WrongPassword999!",
      }),
    });
    if (res13.status === 401) {
      console.log("✅ [PASS] Test 13: Reject login with wrong password (401 Unauthorized)");
    } else {
      throw new Error(`Test 13 Failed: Expected 401, got ${res13.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Protected route GET /api/v1/auth/me with Bearer token
    // -------------------------------------------------------------------------
    const res14 = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const json14 = await res14.json();
    if (res14.status === 200 && json14.data?.user?.email === "alice_auth@test.local" && !json14.data.user.password) {
      console.log("✅ [PASS] Test 14: GET /api/v1/auth/me returns sanitized user profile without password");
    } else {
      throw new Error(`Test 14 Failed: Expected 200 sanitized profile, got ${res14.status}: ${JSON.stringify(json14)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Strictly reject query-token authentication
    // -------------------------------------------------------------------------
    const res15 = await fetch(`${baseUrl}/api/v1/auth/me?token=${aliceToken}`);
    if (res15.status === 401) {
      console.log("✅ [PASS] Test 15: Strictly reject URL query-token authentication (Security fix confirmed)");
    } else {
      throw new Error(`Test 15 Failed: Query token should have been rejected with 401, got ${res15.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 16: Successful logout and cookie invalidation
    // -------------------------------------------------------------------------
    const res16 = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: `token=${aliceToken}` },
    });
    const logoutCookie = res16.headers.get("set-cookie") || "";
    if (res16.status === 200 && (logoutCookie.includes("token=;") || logoutCookie.includes("Expires="))) {
      console.log("✅ [PASS] Test 16: Successful logout clears session cookie");
    } else {
      throw new Error(`Test 16 Failed: Expected cookie clearance, got ${res16.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Forgot password request creates hashed reset token in DB
    // -------------------------------------------------------------------------
    const res17 = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice_auth@test.local" }),
    });
    const json17 = await res17.json();
    const userWithReset = await prisma.user.findUnique({ where: { email: "alice_auth@test.local" } });
    if (res17.status === 200 && userWithReset?.resetPasswordToken && userWithReset.resetPasswordToken.length === 64) {
      console.log("✅ [PASS] Test 17: Forgot password generates cryptographically hashed reset token");
    } else {
      throw new Error(`Test 17 Failed: Expected 200 and hashed reset token, got ${res17.status}: ${JSON.stringify(json17)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 18: Reset password with code updates password and clears token
    // -------------------------------------------------------------------------
    const knownResetCode = "333999";
    await prisma.user.update({
      where: { email: "alice_auth@test.local" },
      data: {
        resetPasswordToken: hashSecret(knownResetCode),
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const res18 = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        token: knownResetCode,
        newPassword: "BrandNewPassword999!",
      }),
    });
    const json18 = await res18.json();
    const userAfterReset = await prisma.user.findUnique({ where: { email: "alice_auth@test.local" } });
    if (res18.status === 200 && userAfterReset?.resetPasswordToken === null) {
      console.log("✅ [PASS] Test 18: Reset password with code updates password and invalidates reset token");
    } else {
      throw new Error(`Test 18 Failed: Expected 200 and cleared reset token, got ${res18.status}: ${JSON.stringify(json18)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 19: Login with new password succeeds and old password fails
    // -------------------------------------------------------------------------
    const res19Old = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice_auth@test.local", password: "SecurePassword123!" }),
    });
    const res19New = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice_auth@test.local", password: "BrandNewPassword999!" }),
    });
    if (res19Old.status === 401 && res19New.status === 200) {
      console.log("✅ [PASS] Test 19: Old password rejected and newly reset password logs in successfully");
    } else {
      throw new Error(`Test 19 Failed: Expected old 401 and new 200, got ${res19Old.status} and ${res19New.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 20: Registration OTP spam protection (Cooldown for unverified accounts)
    // -------------------------------------------------------------------------
    const res20a = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Spam Target",
        email: "spam_auth@test.local",
        password: "ValidPassword123!",
      }),
    });
    if (res20a.status !== 201) {
      throw new Error(`Test 20 Failed: Expected 201 on first registration, got ${res20a.status}`);
    }

    // Immediate second registration with same unverified email should be rejected by 60s cooldown
    const res20b = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Spam Target",
        email: "spam_auth@test.local",
        password: "ValidPassword123!",
      }),
    });
    const json20b = await res20b.json();
    if (res20b.status === 400 && json20b.error?.message?.includes("recently sent")) {
      console.log("✅ [PASS] Test 20: Reject immediate duplicate registration for unverified email (Spam cooldown protection)");
    } else {
      throw new Error(`Test 20 Failed: Expected 400 cooldown spam rejection, got ${res20b.status}: ${JSON.stringify(json20b)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 21: Password reset attempts tracking and brute-force invalidation
    // -------------------------------------------------------------------------
    const resetAttemptEmail = "bob_auth@test.local";
    const actualResetCode = "882244";
    await prisma.user.update({
      where: { email: resetAttemptEmail },
      data: {
        resetPasswordToken: hashSecret(actualResetCode),
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
        resetPasswordAttempts: 0,
      },
    });

    // 1st wrong attempt
    const res21First = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: resetAttemptEmail,
        token: "000000",
        newPassword: "BrandNewPassword123!",
      }),
    });
    const json21First = await res21First.json();
    const userAfter1stWrong = await prisma.user.findUnique({ where: { email: resetAttemptEmail } });
    if (res21First.status === 400 && userAfter1stWrong?.resetPasswordAttempts === 1 && json21First.error?.message?.includes("4 attempts remaining")) {
      console.log("✅ [PASS] Test 21a: Reject wrong password reset code and track attempt counter (resetPasswordAttempts = 1)");
    } else {
      throw new Error(`Test 21a Failed: Expected 400 with 4 attempts remaining, got ${res21First.status}: ${JSON.stringify(json21First)}`);
    }

    // Attempts 2, 3, 4
    for (let i = 2; i <= 4; i++) {
      await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetAttemptEmail,
          token: "000000",
          newPassword: "BrandNewPassword123!",
        }),
      });
    }

    // 5th wrong attempt: should invalidate reset token
    const res21Fifth = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: resetAttemptEmail,
        token: "000000",
        newPassword: "BrandNewPassword123!",
      }),
    });
    const json21Fifth = await res21Fifth.json();
    const userAfter5thWrong = await prisma.user.findUnique({ where: { email: resetAttemptEmail } });
    if (
      res21Fifth.status === 400 &&
      json21Fifth.error?.message?.includes("invalidated") &&
      userAfter5thWrong?.resetPasswordToken === null
    ) {
      console.log("✅ [PASS] Test 21b: Invalidate reset token after 5 failed attempts (Brute-force protection)");
    } else {
      throw new Error(`Test 21b Failed: Expected reset token invalidation, got ${res21Fifth.status}: ${JSON.stringify(json21Fifth)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 22: Cryptographically secure 6-digit OTP code generation
    // -------------------------------------------------------------------------
    const generatedCodes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = authService.generate6DigitCode();
      if (!/^\d{6}$/.test(code) || parseInt(code, 10) < 100000 || parseInt(code, 10) > 999999) {
        throw new Error(`Test 22 Failed: Invalid 6-digit code format generated: ${code}`);
      }
      generatedCodes.add(code);
    }
    // High entropy check across 50 random samples
    if (generatedCodes.size >= 45) {
      console.log("✅ [PASS] Test 22: OTP generator produces cryptographically secure, high-entropy 6-digit integers [100000, 999999]");
    } else {
      throw new Error(`Test 22 Failed: Insufficient entropy in generated codes: ${generatedCodes.size}/50 unique`);
    }

    // -------------------------------------------------------------------------
    // TEST 23: Email dispatch failure handling with transactional rollback
    // -------------------------------------------------------------------------
    // Mock failing mail transporter
    authService.setMailTransporter({
      sendMail: async () => {
        throw new Error("Simulated SMTP Connection Refused");
      },
    } as any);

    const res23 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Failing Mail User",
        email: "email_fail_user@test.local",
        password: "ValidPassword123!",
      }),
    });
    const json23 = await res23.json();

    // Verify DB: User must have been cleaned up/rolled back
    const userInDbAfterEmailFail = await prisma.user.findUnique({
      where: { email: "email_fail_user@test.local" },
    });

    // Restore mail transporter
    authService.setMailTransporter(null);

    if (
      res23.status === 500 &&
      json23.error?.code === "EMAIL_DISPATCH_FAILED" &&
      userInDbAfterEmailFail === null
    ) {
      console.log("✅ [PASS] Test 23: Email failure returns 500 EMAIL_DISPATCH_FAILED and triggers transactional DB rollback");
    } else {
      throw new Error(`Test 23 Failed: Expected 500 and user deletion, got status ${res23.status}, user: ${JSON.stringify(userInDbAfterEmailFail)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 24: Legacy /api/auth/* routes completely removed and dead (404)
    // -------------------------------------------------------------------------
    const legacyEndpoints = [
      { method: "POST", url: `${baseUrl}/api/auth/register` },
      { method: "POST", url: `${baseUrl}/api/auth/login` },
      { method: "POST", url: `${baseUrl}/api/auth/verify-otp` },
      { method: "GET", url: `${baseUrl}/api/auth/me` },
    ];

    for (const ep of legacyEndpoints) {
      const legacyRes = await fetch(ep.url, { method: ep.method });
      if (legacyRes.status !== 404) {
        throw new Error(`Test 24 Failed: Legacy route ${ep.url} should be 404 Not Found, got ${legacyRes.status}`);
      }
    }
    console.log("✅ [PASS] Test 24: Legacy /api/auth/* surface is completely removed and unmounted (Returns 404 Not Found)");

    // -------------------------------------------------------------------------
    // TEST 25: Login creates server-side session with hashed token & session cookie
    // -------------------------------------------------------------------------
    const loginRes25 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        password: "BrandNewPassword999!",
      }),
    });
    const loginJson25 = await loginRes25.json();
    const setCookie25 = loginRes25.headers.get("set-cookie") || "";
    const sessionToken25 = loginJson25.data?.token;

    if (loginRes25.status !== 200 || !sessionToken25) {
      throw new Error(`Test 25 Failed: Expected 200 with session token, got ${loginRes25.status}`);
    }

    // Verify session cookie was set
    if (!setCookie25.includes(`${SESSION_COOKIE_NAME}=`) && !setCookie25.includes("pdf_session=")) {
      throw new Error(`Test 25 Failed: Expected session cookie to be set, got ${setCookie25}`);
    }

    // Verify database record has SHA-256 token hash and NOT plaintext raw token
    const tokenHash25 = sessionService.hashSessionToken(sessionToken25);
    const sessionInDb25 = await prisma.session.findUnique({
      where: { tokenHash: tokenHash25 },
    });

    if (!sessionInDb25 || sessionInDb25.revokedAt !== null || sessionInDb25.tokenHash === sessionToken25) {
      throw new Error("Test 25 Failed: Database session not found or raw plaintext token persisted!");
    }
    console.log("✅ [PASS] Test 25: Login creates server-side session with SHA-256 hashed token & HttpOnly session cookie");

    // -------------------------------------------------------------------------
    // TEST 26: Session-based /me authenticated profile access
    // -------------------------------------------------------------------------
    const meRes26 = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${sessionToken25}`,
      },
    });
    const meJson26 = await meRes26.json();
    if (meRes26.status === 200 && meJson26.data?.user?.email === "alice_auth@test.local" && meJson26.data?.sessionId) {
      console.log("✅ [PASS] Test 26: GET /api/v1/auth/me verifies active server-side session and returns user profile");
    } else {
      throw new Error(`Test 26 Failed: Expected 200 with session profile, got ${meRes26.status}: ${JSON.stringify(meJson26)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 27: Reject invalid, expired, and revoked session tokens on /me
    // -------------------------------------------------------------------------
    // 27a: Invalid random token
    const res27Invalid = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=invalid_random_session_token_12345` },
    });
    if (res27Invalid.status !== 401) {
      throw new Error(`Test 27a Failed: Expected 401 for unknown token, got ${res27Invalid.status}`);
    }

    // 27b: Expired session
    const expiredRawToken = "expired_raw_session_token_999";
    const expiredTokenHash = sessionService.hashSessionToken(expiredRawToken);
    await prisma.session.create({
      data: {
        userId: sessionInDb25.userId,
        tokenHash: expiredTokenHash,
        expiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
      },
    });
    const res27Expired = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${expiredRawToken}` },
    });
    const json27Expired = await res27Expired.json();
    if (res27Expired.status === 401 && json27Expired.error?.code === "SESSION_EXPIRED") {
      console.log("✅ [PASS] Test 27b: Reject expired session with 401 SESSION_EXPIRED");
    } else {
      throw new Error(`Test 27b Failed: Expected 401 SESSION_EXPIRED, got ${res27Expired.status}: ${JSON.stringify(json27Expired)}`);
    }

    // 27c: Revoked session
    const revokedRawToken = "revoked_raw_session_token_888";
    const revokedTokenHash = sessionService.hashSessionToken(revokedRawToken);
    await prisma.session.create({
      data: {
        userId: sessionInDb25.userId,
        tokenHash: revokedTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(),
      },
    });
    const res27Revoked = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${revokedRawToken}` },
    });
    const json27Revoked = await res27Revoked.json();
    if (res27Revoked.status === 401 && json27Revoked.error?.code === "SESSION_REVOKED") {
      console.log("✅ [PASS] Test 27c: Reject revoked session with 401 SESSION_REVOKED");
    } else {
      throw new Error(`Test 27c Failed: Expected 401 SESSION_REVOKED, got ${res27Revoked.status}: ${JSON.stringify(json27Revoked)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 28: Logout revokes session in DB and invalidates subsequent requests
    // -------------------------------------------------------------------------
    // Create fresh session for logout test
    const loginRes28 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        password: "BrandNewPassword999!",
      }),
    });
    const loginJson28 = await loginRes28.json();
    const activeToken28 = loginJson28.data?.token;

    // Call logout
    const logoutRes28 = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${activeToken28}` },
    });
    const logoutCookie28 = logoutRes28.headers.get("set-cookie") || "";

    // Check DB: session's revokedAt must be set
    const tokenHash28 = sessionService.hashSessionToken(activeToken28);
    const sessionAfterLogout = await prisma.session.findUnique({
      where: { tokenHash: tokenHash28 },
    });

    if (
      logoutRes28.status === 200 &&
      sessionAfterLogout?.revokedAt !== null &&
      (logoutCookie28.includes("Expires=") || logoutCookie28.includes("Max-Age=0") || logoutCookie28.includes("pdf_session=;"))
    ) {
      console.log("✅ [PASS] Test 28a: Logout revokes server-side session in database and clears session cookies");
    } else {
      throw new Error(`Test 28a Failed: Expected session revocation in DB and cleared cookies, got status ${logoutRes28.status}`);
    }

    // Subsequent call with revoked token must be rejected
    const meRes28After = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${activeToken28}` },
    });
    if (meRes28After.status === 401) {
      console.log("✅ [PASS] Test 28b: Replay of logged-out session token is strictly rejected with 401");
    } else {
      throw new Error(`Test 28b Failed: Expected 401 after logout, got ${meRes28After.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 29: Password reset revokes all prior active sessions
    // -------------------------------------------------------------------------
    // User logs in and gets an active session
    const loginRes29 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        password: "BrandNewPassword999!",
      }),
    });
    const sessionTokenPreReset = (await loginRes29.json()).data?.token;

    // Setup password reset token
    const aliceResetCode = "771133";
    await prisma.user.update({
      where: { email: "alice_auth@test.local" },
      data: {
        resetPasswordToken: hashSecret(aliceResetCode),
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
        resetPasswordAttempts: 0,
      },
    });

    // Reset password
    const resetRes29 = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice_auth@test.local",
        token: aliceResetCode,
        newPassword: "PostResetPassword123!",
      }),
    });

    if (resetRes29.status !== 200) {
      throw new Error(`Test 29 Failed: Expected 200 reset password, got ${resetRes29.status}`);
    }

    // Prior active session must now be revoked in DB and rejected on /me
    const meRes29AfterReset = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${sessionTokenPreReset}` },
    });
    if (meRes29AfterReset.status === 401) {
      console.log("✅ [PASS] Test 29: Password reset successfully revokes all prior active sessions (Session Hijack Prevention)");
    } else {
      throw new Error(`Test 29 Failed: Prior session still active after password reset! Got ${meRes29AfterReset.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 30: Old/Forged stateless JWT is strictly rejected with 401
    // -------------------------------------------------------------------------
    const forgedStatelessJwt = jwt.sign(
      { id: "fake_or_old_user_id", email: "alice_auth@test.local" },
      envConfig.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const jwtBearerRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${forgedStatelessJwt}` },
    });
    const jwtCookieRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${forgedStatelessJwt}` },
    });

    if (jwtBearerRes.status === 401 && jwtCookieRes.status === 401) {
      console.log("✅ [PASS] Test 30: Stateless JWT fallback completely removed (Bearer & Cookie JWT strictly return 401 Unauthorized)");
    } else {
      throw new Error(`Test 30 Failed: Expected 401 for JWT token, got Bearer=${jwtBearerRes.status}, Cookie=${jwtCookieRes.status}`);
    }

    console.log("\n===============================================================");
    console.log("🎉 ALL 30 AUTHENTICATION & SECURITY TESTS PASSED! (100% SUCCESS)");
    console.log("===============================================================");
  } finally {
    server.close();
  }
}

runAuthTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Auth test suite failed:", err);
    process.exit(1);
  });
