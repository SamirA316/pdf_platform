import { Response } from "express";

export interface ApiResponseSuccess<T = any> {
  success: true;
  data: T;
}

export interface ApiResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): Response {
  const body: ApiResponseSuccess<T> = {
    success: true,
    data,
  };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): Response {
  const body: ApiResponseError = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return res.status(statusCode).json(body);
}
