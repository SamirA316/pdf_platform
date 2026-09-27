import { z } from "zod";

/**
 * Password Policy:
 * - Minimum 8 characters, maximum 128 characters
 * - Must contain at least one letter and at least one digit
 */
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters long." })
    .max(60, { message: "Name cannot exceed 60 characters." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long." })
    .max(128, { message: "Password cannot exceed 128 characters." })
    .regex(passwordRegex, {
      message: "Password must contain at least one letter and at least one number.",
    }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address." }),
  password: z
    .string()
    .min(1, { message: "Password is required." }),
});

export const verifyOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address." }),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: "OTP must be a 6-digit numeric code." }),
});

export const resendOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address." }),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address." }),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address." }),
  token: z
    .string()
    .trim()
    .min(6, { message: "Reset code/token must be at least 6 characters long." }),
  newPassword: z
    .string()
    .min(8, { message: "New password must be at least 8 characters long." })
    .max(128, { message: "New password cannot exceed 128 characters." })
    .regex(passwordRegex, {
      message: "New password must contain at least one letter and at least one number.",
    }),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Current password is required." }),
    newPassword: z
      .string()
      .min(8, { message: "New password must be at least 8 characters long." })
      .max(128, { message: "New password cannot exceed 128 characters." })
      .regex(passwordRegex, {
        message: "New password must contain at least one letter and at least one number.",
      }),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must differ from current password.",
    path: ["newPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
