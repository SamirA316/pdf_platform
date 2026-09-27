export interface IPublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUpdateProfileInput {
  name: string;
}

/**
 * Central reusable public user serializer / DTO mapper (A5).
 * Strictly guarantees that sensitive fields (password, passwordHash, otp,
 * reset tokens, session tokens, etc.) can never leak into responses.
 */
export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: any;
}): IPublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: typeof user.createdAt === "string" ? new Date(user.createdAt) : user.createdAt,
    updatedAt: typeof user.updatedAt === "string" ? new Date(user.updatedAt) : user.updatedAt,
  };
}
