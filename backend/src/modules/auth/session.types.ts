export interface ISessionDto {
  id: string;
  userId?: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  current: boolean;
  revoked: boolean;
}

export interface ICreateSessionResult {
  session: ISessionDto;
  rawToken: string;
}

export interface IValidateSessionResult {
  valid: boolean;
  reason?: "EXPIRED" | "REVOKED" | "NOT_FOUND";
  userId?: string;
  sessionId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}
