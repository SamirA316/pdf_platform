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
 * Fetch current authenticated user session
 * GET /api/v1/auth/me
 */
export async function getMe(): Promise<{ user: UserProfile | null }> {
  return apiClient<{ user: UserProfile | null }>("/api/v1/auth/me");
}

/**
 * Log in with email and password
 * POST /api/v1/auth/login
 */
export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  return apiClient<AuthResponse>("/api/v1/auth/login", { data: payload });
}

/**
 * Register a new user account
 * POST /api/v1/auth/register
 */
export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return apiClient<AuthResponse>("/api/v1/auth/register", { data: payload });
}

/**
 * Verify email OTP
 * POST /api/v1/auth/verify-otp
 */
export async function verifyUserOtp(payload: VerifyOtpPayload): Promise<AuthResponse> {
  return apiClient<AuthResponse>("/api/v1/auth/verify-otp", { data: payload });
}

/**
 * Resend verification OTP with cooldown
 * POST /api/v1/auth/resend-otp
 */
export async function resendUserOtp(payload: ResendOtpPayload): Promise<AuthResponse> {
  return apiClient<AuthResponse>("/api/v1/auth/resend-otp", { data: payload });
}

/**
 * Request password reset email
 * POST /api/v1/auth/forgot-password
 */
export async function forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
  return apiClient<{ message: string }>("/api/v1/auth/forgot-password", { data: payload });
}

/**
 * Submit new password with reset code
 * POST /api/v1/auth/reset-password
 */
export async function resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
  return apiClient<{ message: string }>("/api/v1/auth/reset-password", { data: payload });
}

/**
 * Log out active session
 * POST /api/v1/auth/logout
 */
export async function logoutUser(): Promise<{ message: string }> {
  return apiClient<{ message: string }>("/api/v1/auth/logout", { method: "POST" });
}
