/**
 * src/utils/response.ts
 *
 * Standard response envelope helpers.
 * Every API response — success or error — goes through these functions.
 * Ensures consistent shape: { data, meta, error } across the entire API.
 */

import { PaginationMeta } from '../types';

export interface SuccessEnvelope<T> {
  data: T;
  meta: PaginationMeta | null;
  error: null;
}

export interface ErrorEnvelope {
  data: null;
  meta: null;
  error: { message: string; code: string };
}

export function successResponse<T>(
  data: T,
  meta?: PaginationMeta
): SuccessEnvelope<T> {
  return {
    data,
    meta: meta ?? null,
    error: null,
  };
}

export function errorResponse(
  message: string,
  code = 'ERROR'
): ErrorEnvelope {
  return {
    data: null,
    meta: null,
    error: { message, code },
  };
}
