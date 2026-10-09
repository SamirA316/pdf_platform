import { apiClient } from "./client";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  isVerified?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface ResendOtpPayload {
  email: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  token: string;
  newPassword: string;
}

export interface AuthResponse {
  message?: string;
  user?: UserProfile;
  userId?: string;
  token?: string;
  cooldownSeconds?: number;
}

/**
 * Helper to unwrap response data if wrapped in { success: true, data: T }
 */
function unwrapResponse<T>(res: any): T {
  if (res && typeof res === "object" && "success" in res && "data" in res) {
    return res.data as T;
  }
  return res as T;
}

/**
 * Fetch current authenticated user session
 * GET /api/v1/auth/me
 */
export async function getMe(): Promise<{ user: UserProfile | null }> {
  const res = await apiClient<any>("/api/v1/auth/me");
  return unwrapResponse<{ user: UserProfile | null }>(res);
}

/**
 * Log in with email and password
 * POST /api/v1/auth/login
 */
export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const res = await apiClient<any>("/api/v1/auth/login", { data: payload });
  const unwrapped = unwrapResponse<AuthResponse>(res);
  if (typeof window !== "undefined") {
    if (unwrapped.token) {
      localStorage.setItem("pdf_session_token", unwrapped.token);
    }
    if (unwrapped.user) {
      localStorage.setItem("pdf_user", JSON.stringify(unwrapped.user));
    }
  }
  return unwrapped;
}

/**
 * Register a new user account
 * POST /api/v1/auth/register
 */
export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await apiClient<any>("/api/v1/auth/register", { data: payload });
  return unwrapResponse<AuthResponse>(res);
}

/**
 * Verify email OTP
 * POST /api/v1/auth/verify-otp
 */
export async function verifyUserOtp(payload: VerifyOtpPayload): Promise<AuthResponse> {
  const res = await apiClient<any>("/api/v1/auth/verify-otp", { data: payload });
  const unwrapped = unwrapResponse<AuthResponse>(res);
  if (typeof window !== "undefined") {
    if (unwrapped.token) {
      localStorage.setItem("pdf_session_token", unwrapped.token);
    }
    if (unwrapped.user) {
      localStorage.setItem("pdf_user", JSON.stringify(unwrapped.user));
    }
  }
  return unwrapped;
}

/**
 * Resend verification OTP with cooldown
 * POST /api/v1/auth/resend-otp
 */
export async function resendUserOtp(payload: ResendOtpPayload): Promise<AuthResponse> {
  const res = await apiClient<any>("/api/v1/auth/resend-otp", { data: payload });
  return unwrapResponse<AuthResponse>(res);
}

/**
 * Request password reset email
 * POST /api/v1/auth/forgot-password
 */
export async function forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
  const res = await apiClient<any>("/api/v1/auth/forgot-password", { data: payload });
  return unwrapResponse<{ message: string }>(res);
}

/**
 * Submit new password with reset code
 * POST /api/v1/auth/reset-password
 */
export async function resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
  const res = await apiClient<any>("/api/v1/auth/reset-password", { data: payload });
  return unwrapResponse<{ message: string }>(res);
}

/**
 * Log out active session
 * POST /api/v1/auth/logout
 */
export async function logoutUser(): Promise<{ message: string }> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("pdf_session_token");
    localStorage.removeItem("pdf_user");
  }
  const res = await apiClient<any>("/api/v1/auth/logout", { method: "POST" });
  return unwrapResponse<{ message: string }>(res);
}

export interface OAuthConfig {
  googleConfigured: boolean;
  appleConfigured: boolean;
  facebookConfigured: boolean;
}

/**
 * Check which OAuth providers are configured with client IDs on backend
 * GET /api/v1/auth/oauth/config
 */
export async function getOAuthConfig(): Promise<OAuthConfig> {
  const res = await apiClient<any>("/api/v1/auth/oauth/config");
  return unwrapResponse<OAuthConfig>(res);
}

/**
 * Perform social login / account chooser sign-in
 * POST /api/v1/auth/oauth/mock
 */
export async function mockSocialLogin(payload: {
  email: string;
  name?: string;
  provider: "google" | "apple" | "facebook";
}): Promise<AuthResponse> {
  const res = await apiClient<any>("/api/v1/auth/oauth/mock", { data: payload });
  const unwrapped = unwrapResponse<AuthResponse>(res);
  if (typeof window !== "undefined") {
    if (unwrapped.token) {
      localStorage.setItem("pdf_session_token", unwrapped.token);
    }
    if (unwrapped.user) {
      localStorage.setItem("pdf_user", JSON.stringify(unwrapped.user));
    }
  }
  return unwrapped;
}

/**
 * Send 6-digit confirmation code / OTP to user's Google or social email address
 * POST /api/v1/auth/oauth/send-code
 */
export async function sendSocialConfirmationCode(payload: {
  email: string;
  name?: string;
  provider: "google" | "apple" | "facebook";
}): Promise<{ email: string; message: string; cooldownSeconds: number; confirmUrl?: string }> {
  const res = await apiClient<any>("/api/v1/auth/oauth/send-code", { data: payload });
  return unwrapResponse<{ email: string; message: string; cooldownSeconds: number; confirmUrl?: string }>(res);
}

/**
 * 1-Click direct confirmation link verification
 * POST /api/v1/auth/confirm-login
 */
export async function confirmLoginWithToken(payload: {
  email: string;
  token: string;
}): Promise<AuthResponse> {
  const res = await apiClient<any>("/api/v1/auth/confirm-login", { data: payload });
  const unwrapped = unwrapResponse<AuthResponse>(res);
  if (typeof window !== "undefined") {
    if (unwrapped.token) {
      localStorage.setItem("pdf_session_token", unwrapped.token);
    }
    if (unwrapped.user) {
      localStorage.setItem("pdf_user", JSON.stringify(unwrapped.user));
    }
  }
  return unwrapped;
}

/**
 * Check if the user confirmed their login via email link
 * GET /api/v1/auth/confirm-status?email=...
 */
export async function checkConfirmStatus(
  email: string
): Promise<{ confirmed: boolean; session?: { user: any; token: string } }> {
  const res = await apiClient<any>(`/api/v1/auth/confirm-status?email=${encodeURIComponent(email)}`);
  const unwrapped = unwrapResponse<{ confirmed: boolean; session?: { user: any; token: string } }>(res);
  if (typeof window !== "undefined" && unwrapped.session) {
    if (unwrapped.session.token) {
      localStorage.setItem("pdf_session_token", unwrapped.session.token);
    }
    if (unwrapped.session.user) {
      localStorage.setItem("pdf_user", JSON.stringify(unwrapped.session.user));
    }
  }
  return unwrapped;
}



