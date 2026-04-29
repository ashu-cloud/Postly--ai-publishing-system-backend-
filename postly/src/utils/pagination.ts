
import { PaginationMeta, PaginationParams } from '../types';

export function buildPaginationMeta(
  total: number,
  { page, limit }: PaginationParams
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Parse and sanitise page/limit from query string.
 * Clamps: page >= 1, limit in [1, 100].
 */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '10'), 10) || 10));
  return { page, limit };
}

/** Returns the Prisma `skip` value for the given page/limit */
export function getSkip({ page, limit }: PaginationParams): number {
  return (page - 1) * limit;
}
