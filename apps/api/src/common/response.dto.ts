import { v4 as uuidv4 } from 'uuid';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown> | unknown[];
  };
  request_id?: string;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown> | unknown[];

  constructor(code: string, message: string, statusCode: number = 400, details?: Record<string, unknown> | unknown[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown> | unknown[],
  requestId?: string,
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details: details || {},
    },
    request_id: requestId || uuidv4(),
  };
}
