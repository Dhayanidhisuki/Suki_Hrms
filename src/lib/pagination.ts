/**
 * List pagination for the master APIs.
 *
 * These endpoints used to return every row with a hardcoded
 * `{ page: 1, totalPages: 1 }`, which is fine at a handful of records and
 * steadily worse as they grow.
 *
 * Two kinds of caller share one endpoint, so intent has to be explicit:
 *   - a list screen wants a page at a time (`?page=2&limit=20`);
 *   - a dropdown wants the whole set (`?all=true`).
 *
 * `all=true` is still capped, because an unbounded query is the thing being
 * fixed. When the cap is hit the response says so via `truncated` rather than
 * quietly handing back a short list a picker would present as complete.
 */

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 200;
/** Ceiling for `all=true` — high enough for any realistic dropdown. */
export const MAX_ALL = 1000;

export type PageRequest = {
  /** Prisma `skip`, or undefined when fetching everything. */
  skip?: number;
  /** Prisma `take`. Always set, so no query is unbounded. */
  take: number;
  page: number;
  limit: number;
  all: boolean;
};

function toInt(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function parsePageRequest(sp: URLSearchParams): PageRequest {
  const all = sp.get('all') === 'true';
  if (all) {
    return { take: MAX_ALL, page: 1, limit: MAX_ALL, all: true };
  }
  const page = toInt(sp.get('page'), 1);
  const limit = Math.min(toInt(sp.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);
  return { skip: (page - 1) * limit, take: limit, page, limit, all: false };
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Only meaningful for `all=true`: more rows exist than the cap returned. */
  truncated?: boolean;
};

export function buildPagination(req: PageRequest, total: number, returned: number): PaginationMeta {
  if (req.all) {
    return {
      page: 1,
      limit: returned,
      total,
      totalPages: 1,
      ...(total > returned ? { truncated: true } : {}),
    };
  }
  return {
    page: req.page,
    limit: req.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / req.limit)),
  };
}
