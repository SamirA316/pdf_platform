export const SECURITY_EVENT_TYPES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "EMAIL_CHANGE_REQUESTED",
  "EMAIL_CHANGED",
  "ACCOUNT_DEACTIVATED",
  "SESSION_REVOKED",
  "ALL_SESSIONS_REVOKED",
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export interface IRecordSecurityEventParams {
  userId: string;
  type: SecurityEventType;
}

export interface ISecurityEventPublic {
  id: string;
  type: string;
  createdAt: Date;
}

export interface IGetSecurityEventsOptions {
  limit?: number;
  cursor?: string;
}

export interface IGetSecurityEventsResult {
  events: ISecurityEventPublic[];
  nextCursor?: string;
}
