import { createServer } from "http";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { app } from "../src/server";
import { prisma } from "../src/common/prisma";
import { sessionService } from "../src/modules/auth/session.service";
import {
  CSRF_COOKIE_NAME,
} from "../src/middlewares/csrf.middleware";
import {
  loginBruteForceTracker,
  otpResendTracker,
  passwordResetTracker,
} from "../src/middlewares/rateLimiter.middleware";

async function runHardeningTests() {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.4C: Authentication Hardening");
  console.log("===============================================================");

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const BASE_URL = `http://127.0.0.1:${port}`;

  const testUserEmail = "hardening_test_24c@example.com";
  const testUserPassword = "HardenedPassword123!";
  const testUserId = "user_24c_hardening";

  try {
    // Reset trackers and clean up test user
    loginBruteForceTracker.clearAll();
    otpResendTracker.clearAll();
    passwordResetTracker.clearAll();

    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { email: testUserEmail } });

    const hashedPassword = await bcrypt.hash(testUserPassword, 10);
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Hardening Test User",
        email: testUserEmail,
        password: hashedPassword,
        isVerified: true,
      },
    });

    // =========================================================================
    // SECTION 1: C1 — CSRF Protection Tests
    // =========================================================================
    console.log("\n--- SECTION 1: CSRF Protection (C1) ---");

    // Test 1: GET /api/v1/auth/csrf issues token and sets pdf_csrf cookie
    const csrfRes = await fetch(`${BASE_URL}/api/v1/auth/csrf`);
    const csrfJson = await csrfRes.json();
    const setCookie = csrfRes.headers.get("set-cookie") || "";

    if (
      csrfRes.status === 200 &&
      csrfJson.success &&
      csrfJson.data?.csrfToken &&
      setCookie.includes(`${CSRF_COOKIE_NAME}=`)
    ) {
      console.log("✅ [PASS] Test 1: GET /api/v1/auth/csrf returns CSRF token and sets pdf_csrf cookie");
    } else {
      throw new Error(`Test 1 Failed: Expected 200 with csrfToken & cookie, got: ${JSON.stringify(csrfJson)}`);
    }

    const csrfToken = csrfJson.data.csrfToken;
    const validCsrfHeaders = {
      "Content-Type": "application/json",
      Cookie: `${CSRF_COOKIE_NAME}=${csrfToken}`,
      "X-CSRF-Token": csrfToken,
    };

    // Test 2: Mutating request with CSRF cookie but MISSING X-CSRF-Token header -> 403 CSRF_TOKEN_MISSING
    const missingCsrfRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${CSRF_COOKIE_NAME}=${csrfToken}`,
      },
      body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
    });
    const missingCsrfJson = await missingCsrfRes.json();

    if (
      missingCsrfRes.status === 403 &&
      missingCsrfJson.error?.code === "CSRF_TOKEN_MISSING"
    ) {
      console.log("✅ [PASS] Test 2: Missing X-CSRF-Token header with CSRF cookie returns 403 CSRF_TOKEN_MISSING");
    } else {
      throw new Error(`Test 2 Failed: Expected 403 CSRF_TOKEN_MISSING, got: ${missingCsrfRes.status} ${JSON.stringify(missingCsrfJson)}`);
    }

    // Test 2b (NEW): Mutating request with NO CSRF cookie and NO X-CSRF-Token header -> 403 CSRF_TOKEN_MISSING
    const noCsrfRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
    });
    const noCsrfJson = await noCsrfRes.json();

    if (
      noCsrfRes.status === 403 &&
      noCsrfJson.error?.code === "CSRF_TOKEN_MISSING"
    ) {
      console.log("✅ [PASS] Test 2b: Request with NO CSRF cookie and NO header strictly returns 403 CSRF_TOKEN_MISSING");
    } else {
      throw new Error(`Test 2b Failed: Expected 403 CSRF_TOKEN_MISSING, got: ${noCsrfRes.status} ${JSON.stringify(noCsrfJson)}`);
    }

    // Test 3: Mutating request with CSRF cookie and INVALID X-CSRF-Token header -> 403 CSRF_TOKEN_INVALID
    const invalidCsrfRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${CSRF_COOKIE_NAME}=${csrfToken}`,
        "X-CSRF-Token": "forged_invalid_csrf_token_12345",
      },
      body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
    });
    const invalidCsrfJson = await invalidCsrfRes.json();

    if (
      invalidCsrfRes.status === 403 &&
      invalidCsrfJson.error?.code === "CSRF_TOKEN_INVALID"
    ) {
      console.log("✅ [PASS] Test 3: Mismatched X-CSRF-Token header returns 403 CSRF_TOKEN_INVALID");
    } else {
      throw new Error(`Test 3 Failed: Expected 403 CSRF_TOKEN_INVALID, got: ${invalidCsrfRes.status} ${JSON.stringify(invalidCsrfJson)}`);
    }

    // Test 4: Mutating request with VALID matching CSRF cookie and header -> Request allowed (200 OK)
    const validCsrfRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: validCsrfHeaders,
      body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
    });
    const validCsrfJson = await validCsrfRes.json();

    if (validCsrfRes.status === 200 && validCsrfJson.success) {
      console.log("✅ [PASS] Test 4: Valid matching CSRF token allows state-changing request (200 OK)");
    } else {
      throw new Error(`Test 4 Failed: Expected 200, got: ${validCsrfRes.status} ${JSON.stringify(validCsrfJson)}`);
    }

    // Test 5: Mutating request with cross-origin Origin header -> 403 CSRF_ORIGIN_INVALID
    const crossOriginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        ...validCsrfHeaders,
        Origin: "https://malicious-attacker.com",
      },
      body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
    });
    const crossOriginJson = await crossOriginRes.json();

    if (
      crossOriginRes.status === 403 &&
      crossOriginJson.error?.code === "CSRF_ORIGIN_INVALID"
    ) {
      console.log("✅ [PASS] Test 5: Untrusted cross-origin request blocked with 403 CSRF_ORIGIN_INVALID");
    } else {
      throw new Error(`Test 5 Failed: Expected 403 CSRF_ORIGIN_INVALID, got: ${crossOriginRes.status}`);
    }

    // =========================================================================
    // SECTION 2: C2 — Cookie Security Audit
    // =========================================================================
    console.log("\n--- SECTION 2: Cookie Security Audit (C2) ---");

    const sessionCookieHeader = validCsrfRes.headers.get("set-cookie") || "";

    // Test 6: Verify HttpOnly, SameSite=Lax, Path=/, and lack of explicit Domain
    const hasHttpOnly = sessionCookieHeader.toLowerCase().includes("httponly");
    const hasSameSiteLax = sessionCookieHeader.toLowerCase().includes("samesite=lax");
    const hasPathRoot = sessionCookieHeader.includes("Path=/") || sessionCookieHeader.includes("path=/");
    const noExplicitDomain = !sessionCookieHeader.toLowerCase().includes("domain=");

    if (hasHttpOnly && hasSameSiteLax && hasPathRoot && noExplicitDomain) {
      console.log("✅ [PASS] Test 6: Session cookie verified (HttpOnly, SameSite=Lax, Path=/, no explicit Domain)");
    } else {
      throw new Error(`Test 6 Failed: Cookie header check failed: ${sessionCookieHeader}`);
    }

    // =========================================================================
    // SECTION 3: C3 — Login Brute-Force Rate Limiting
    // =========================================================================
    console.log("\n--- SECTION 3: Login Brute-Force Protection (C3) ---");

    loginBruteForceTracker.clearAll();
    const bruteForceEmail = "brute_force_target@example.com";

    // Perform 5 consecutive failed login attempts with valid CSRF
    for (let attempt = 1; attempt <= 5; attempt++) {
      const failRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: validCsrfHeaders,
        body: JSON.stringify({ email: bruteForceEmail, password: "WrongPassword999!" }),
      });
      if (failRes.status !== 401) {
        throw new Error(`Expected attempt ${attempt} to fail with 401, got ${failRes.status}`);
      }
    }
    console.log("✅ [PASS] Test 7: 5 failed login attempts recorded");

    // 6th attempt should be blocked by loginBruteForceGuard (429 Too Many Requests)
    const blockedRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: validCsrfHeaders,
      body: JSON.stringify({ email: bruteForceEmail, password: "WrongPassword999!" }),
    });
    const blockedJson = await blockedRes.json();

    if (
      blockedRes.status === 429 &&
      blockedJson.error?.code === "LOGIN_RATE_LIMIT_EXCEEDED"
    ) {
      console.log("✅ [PASS] Test 8: 6th failed login attempt blocked with 429 LOGIN_RATE_LIMIT_EXCEEDED");
    } else {
      throw new Error(`Test 8 Failed: Expected 429 LOGIN_RATE_LIMIT_EXCEEDED, got: ${blockedRes.status} ${JSON.stringify(blockedJson)}`);
    }

    // Reset tracker for subsequent tests
    loginBruteForceTracker.clearAll();

    // =========================================================================
    // SECTION 4: C4 — OTP Abuse Protection & Atomic Increment
    // =========================================================================
    console.log("\n--- SECTION 4: OTP Abuse Protection & Atomic Limit (C4) ---");

    const otpUserEmail = "otp_abuse_test@example.com";
    await prisma.user.deleteMany({ where: { email: otpUserEmail } });

    const rawOtp = "123456";
    const hashedOtp = crypto.createHash("sha256").update(rawOtp).digest("hex");
    const otpUser = await prisma.user.create({
      data: {
        name: "OTP Test",
        email: otpUserEmail,
        password: hashedPassword,
        isVerified: false,
        otp: hashedOtp,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        otpLastSentAt: new Date(),
      },
    });

    // Test 9: 5 incorrect OTP attempts atomically invalidate the OTP
    for (let i = 1; i <= 4; i++) {
      const wrongOtpRes = await fetch(`${BASE_URL}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: validCsrfHeaders,
        body: JSON.stringify({ email: otpUserEmail, otp: "000000" }),
      });
      if (wrongOtpRes.status !== 400) {
        throw new Error(`Expected OTP attempt ${i} to fail with 400, got ${wrongOtpRes.status}`);
      }
    }

    // 5th attempt invalidates
    const finalWrongRes = await fetch(`${BASE_URL}/api/v1/auth/verify-otp`, {
      method: "POST",
      headers: validCsrfHeaders,
      body: JSON.stringify({ email: otpUserEmail, otp: "000000" }),
    });
    const finalWrongJson = await finalWrongRes.json();

    const dbUserAfterOtp = await prisma.user.findUnique({ where: { id: otpUser.id } });
    if (
      finalWrongRes.status === 400 &&
      finalWrongJson.error?.message?.includes("invalidated") &&
      dbUserAfterOtp?.otp === null
    ) {
      console.log("✅ [PASS] Test 9: 5 failed OTP attempts atomically invalidate OTP code in database");
    } else {
      throw new Error(`Test 9 Failed: Expected OTP invalidation, got: ${JSON.stringify(finalWrongJson)}`);
    }

    // Test 10: Resend OTP abuse limiter blocks repeated spam requests
    otpResendTracker.clearAll();
    const resendEmail = "otp_resend_abuse@example.com";
    for (let r = 1; r <= 3; r++) {
      otpResendTracker.increment("127.0.0.1", resendEmail);
    }

    const spamResendRes = await fetch(`${BASE_URL}/api/v1/auth/resend-otp`, {
      method: "POST",
      headers: validCsrfHeaders,
      body: JSON.stringify({ email: resendEmail }),
    });
    const spamResendJson = await spamResendRes.json();

    if (
      spamResendRes.status === 429 &&
      spamResendJson.error?.code === "OTP_RESEND_RATE_LIMIT_EXCEEDED"
    ) {
      console.log("✅ [PASS] Test 10: OTP resend abuse limiter blocks spam requests with 429 OTP_RESEND_RATE_LIMIT_EXCEEDED");
    } else {
      throw new Error(`Test 10 Failed: Expected 429, got: ${spamResendRes.status}`);
    }

    otpResendTracker.clearAll();

    // =========================================================================
    // SECTION 5: C5 — Password Reset Abuse Protection & Anti-Enumeration
    // =========================================================================
    console.log("\n--- SECTION 5: Password Reset Abuse Protection (C5) ---");

    // Test 11: Unknown email returns identical generic 200 without account enumeration
    const unknownForgotRes = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: validCsrfHeaders,
      body: JSON.stringify({ email: "definitely_non_existent_account_9999@test.local" }),
    });
    const unknownForgotJson = await unknownForgotRes.json();

    const expectedGenericMsg =
      "If an account exists with this email, a password reset code has been sent.";

    if (
      unknownForgotRes.status === 200 &&
      unknownForgotJson.data?.message === expectedGenericMsg
    ) {
      console.log("✅ [PASS] Test 11: Non-existent email returns generic message without account enumeration");
    } else {
      throw new Error(`Test 11 Failed: Expected generic message, got: ${JSON.stringify(unknownForgotJson)}`);
    }

    // Test 12: Existing verified email returns the exact same generic message
    const existingForgotRes = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: validCsrfHeaders,
      body: JSON.stringify({ email: testUserEmail }),
    });
    const existingForgotJson = await existingForgotRes.json();

    if (
      existingForgotRes.status === 200 &&
      existingForgotJson.data?.message === expectedGenericMsg
    ) {
      console.log("✅ [PASS] Test 12: Existing email returns identical generic message (Indistinguishable response)");
    } else {
      throw new Error(`Test 12 Failed: Expected matching generic message, got: ${JSON.stringify(existingForgotJson)}`);
    }

    // Test 13: Password reset request rate limiter blocks excessive requests
    passwordResetTracker.clearAll();
    for (let p = 1; p <= 10; p++) {
      passwordResetTracker.increment("127.0.0.1", testUserEmail);
    }

    const spamResetReq = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: validCsrfHeaders,
      body: JSON.stringify({ email: testUserEmail }),
    });
    const spamResetJson = await spamResetReq.json();

    if (
      spamResetReq.status === 429 &&
      spamResetJson.error?.code === "PASSWORD_RESET_RATE_LIMIT_EXCEEDED"
    ) {
      console.log("✅ [PASS] Test 13: Excessive forgot-password requests blocked with 429 PASSWORD_RESET_RATE_LIMIT_EXCEEDED");
    } else {
      throw new Error(`Test 13 Failed: Expected 429, got: ${spamResetReq.status}`);
    }

    passwordResetTracker.clearAll();

    // =========================================================================
    // SECTION 6: C6 — Session Fixation Protection
    // =========================================================================
    console.log("\n--- SECTION 6: Session Fixation Protection (C6) ---");

    // Test 14: Distinct logins generate distinct 32-byte high-entropy session tokens
    const session1 = await sessionService.createSession(testUserId);
    const session2 = await sessionService.createSession(testUserId);

    if (
      session1.rawToken !== session2.rawToken &&
      session1.rawToken.length === 64 &&
      session2.rawToken.length === 64
    ) {
      console.log("✅ [PASS] Test 14: New authentications generate unique, high-entropy 256-bit crypto session tokens");
    } else {
      throw new Error(`Test 14 Failed: Session tokens are not unique or properly sized`);
    }

    // =========================================================================
    // SECTION 7: C7 & C8 — Security Headers & Error Consistency
    // =========================================================================
    console.log("\n--- SECTION 7: Security Headers & Error Consistency (C7 & C8) ---");

    const headerCheckRes = await fetch(`${BASE_URL}/api/v1/health`);
    const xContentType = headerCheckRes.headers.get("x-content-type-options");
    const xFrameOptions = headerCheckRes.headers.get("x-frame-options");
    const referrerPolicy = headerCheckRes.headers.get("referrer-policy");

    if (
      xContentType === "nosniff" &&
      xFrameOptions === "SAMEORIGIN" &&
      referrerPolicy === "strict-origin-when-cross-origin"
    ) {
      console.log("✅ [PASS] Test 15: Security headers verified (nosniff, SAMEORIGIN, strict-origin-when-cross-origin)");
    } else {
      throw new Error(
        `Test 15 Failed: Headers mismatch - X-Content-Type: ${xContentType}, X-Frame: ${xFrameOptions}, Referrer: ${referrerPolicy}`
      );
    }

    // Test 16: Login error consistency (returns "Invalid email or password." without leaking user existence)
    const badLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: validCsrfHeaders,
      body: JSON.stringify({ email: "unknown_random_account@example.com", password: "SomePassword123!" }),
    });
    const badLoginJson = await badLoginRes.json();

    if (
      badLoginRes.status === 401 &&
      badLoginJson.error?.message === "Invalid email or password."
    ) {
      console.log("✅ [PASS] Test 16: Login error is strictly consistent ('Invalid email or password.')");
    } else {
      throw new Error(`Test 16 Failed: Expected generic invalid credentials message, got: ${JSON.stringify(badLoginJson)}`);
    }

    // Test 17: Strict V1 auth rejects legacy JWT bearer token with 401
    const fakeJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M";
    const jwtRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${fakeJwt}` },
    });

    if (jwtRes.status === 401) {
      console.log("✅ [PASS] Test 17: Legacy JWT token strictly rejected with 401 on strict V1 session auth");
    } else {
      throw new Error(`Test 17 Failed: Expected 401 for legacy JWT, got: ${jwtRes.status}`);
    }

    console.log("\n===============================================================");
    console.log("🎉 ALL 18 PHASE 2.4C AUTHENTICATION HARDENING TESTS PASSED!");
    console.log("===============================================================\n");
  } finally {
    // Cleanup
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { email: testUserEmail } });
    server.close();
  }
}

runHardeningTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Phase 2.4C hardening test suite failed:", err);
    process.exit(1);
  });
