import { z } from "zod";

/**
 * Validation schema for PATCH /api/v1/users/me (A6).
 * Enforces non-empty, trimmed string between 1 and 100 characters.
 */
export const updateProfileSchema = z.object({
  name: z
    .string({ message: "Name must be a valid string." })
    .trim()
    .min(1, { message: "Name cannot be empty or whitespace only." })
    .max(100, { message: "Name cannot exceed 100 characters." }),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

/**
 * Validation schema for POST /api/v1/users/me/email/change-request (B1)
 */
export const requestEmailChangeSchema = z.object({
  newEmail: z
    .string({ message: "New email must be a valid string." })
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address." }),
});

export type RequestEmailChangeDto = z.infer<typeof requestEmailChangeSchema>;

/**
 * Validation schema for POST /api/v1/users/me/email/verify (B3)
 */
export const verifyEmailChangeSchema = z.object({
  code: z
    .string({ message: "Verification code must be a string." })
    .trim()
    .min(1, { message: "Verification code is required." })
    .length(6, { message: "Verification code must be exactly 6 digits." })
    .regex(/^\d{6}$/, { message: "Verification code must be a 6-digit number." }),
});

export type VerifyEmailChangeDto = z.infer<typeof verifyEmailChangeSchema>;

/**
 * Validation schema for POST /api/v1/users/me/deactivate (C1)
 */
export const deactivateAccountSchema = z.object({
  currentPassword: z
    .string({ message: "Current password must be a string." })
    .min(1, { message: "Current password is required." }),
});

export type DeactivateAccountDto = z.infer<typeof deactivateAccountSchema>;

/**
 * Validation schema for DELETE /api/v1/users/me (C4)
 */
export const deleteAccountSchema = z.object({
  currentPassword: z
    .string({ message: "Current password must be a string." })
    .min(1, { message: "Current password is required." }),
});

export type DeleteAccountDto = z.infer<typeof deleteAccountSchema>;

/**
 * Validation schema for GET /api/v1/users/me/security-events (D4, D5)
 */
export const getSecurityEventsQuerySchema = z.object({
  limit: z.coerce
    .number({ message: "Limit must be a number." })
    .int({ message: "Limit must be an integer." })
    .min(1, { message: "Limit must be at least 1." })
    .max(100, { message: "Limit cannot exceed 100." })
    .optional()
    .default(20),
  cursor: z
    .string({ message: "Cursor must be a string." })
    .trim()
    .optional(),
});

export type GetSecurityEventsQueryDto = z.infer<typeof getSecurityEventsQuerySchema>;


