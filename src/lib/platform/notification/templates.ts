/**
 * Template selection (BRD §12.3) as a pure function over an in-memory
 * candidate list, so it can be unit-tested without a database. The DB
 * loader that feeds it lives in service.ts.
 *
 *   1. language  = recipient preferred language, else en-IN
 *   2. candidates = eventCode + channel + Active + effective at T
 *   3. narrow by language; if none, fall back to en-IN
 *   4. narrow by designationFilter matching R, then departmentFilter
 *   5. more than one → latest effectiveFrom (tie → highest versionNo)
 *   6. none → null (caller records FailedNoTemplate)
 */

export const DEFAULT_LANGUAGE = 'en-IN';

export type TemplateCandidate = {
  id: number;
  eventCode: string;
  channel: string;
  language: string;
  status: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  designationFilter: string | null;
  departmentFilter: string | null;
  versionNo: number;
};

export type TemplateRecipientAttrs = {
  designation?: string | null;
  designationCode?: string | null;
  department?: string | null;
  departmentCode?: string | null;
  language?: string | null;
};

export type TemplateQuery = {
  eventCode: string;
  channel: string;
  language?: string | null;
  at?: Date;
  recipient?: TemplateRecipientAttrs | null;
};

/** Filter is a comma-separated list of codes or names; matches case-insensitively. */
export function filterMatches(filter: string | null | undefined, ...values: (string | null | undefined)[]): boolean {
  if (!filter || !filter.trim()) return true;
  const wanted = filter.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return true;
  return values.some((v) => v && wanted.includes(v.trim().toLowerCase()));
}

/** Date-only columns come back as UTC midnight; compare on the UTC calendar day. */
function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isEffective(t: TemplateCandidate, at: Date): boolean {
  const day = utcDay(at);
  if (utcDay(t.effectiveFrom) > day) return false;
  if (t.effectiveTo && utcDay(t.effectiveTo) < day) return false;
  return true;
}

/**
 * Prefer templates whose filter names the recipient; drop templates whose
 * filter names someone else; templates without a filter apply to everyone
 * but lose to a matching filtered one.
 */
function narrowByFilter<T extends TemplateCandidate>(list: T[], pick: (t: T) => string | null, ...values: (string | null | undefined)[]): T[] {
  const specific = list.filter((t) => {
    const f = pick(t);
    return !!f && f.trim() && filterMatches(f, ...values);
  });
  if (specific.length) return specific;
  return list.filter((t) => !pick(t) || !pick(t)!.trim());
}

export function selectTemplate<T extends TemplateCandidate>(all: T[], q: TemplateQuery): T | null {
  const at = q.at ?? new Date();
  const base = all.filter(
    (t) => t.eventCode === q.eventCode && t.channel === q.channel && t.status === 'Active' && isEffective(t, at),
  );
  if (base.length === 0) return null;

  const lang = (q.language ?? q.recipient?.language ?? DEFAULT_LANGUAGE).trim();
  let byLang = base.filter((t) => t.language === lang);
  if (byLang.length === 0) byLang = base.filter((t) => t.language === DEFAULT_LANGUAGE);
  if (byLang.length === 0) return null;

  const r = q.recipient ?? {};
  let narrowed = narrowByFilter(byLang, (t) => t.designationFilter, r.designationCode, r.designation);
  narrowed = narrowByFilter(narrowed, (t) => t.departmentFilter, r.departmentCode, r.department);
  if (narrowed.length === 0) return null;

  narrowed.sort((a, b) => {
    const d = utcDay(b.effectiveFrom) - utcDay(a.effectiveFrom);
    return d !== 0 ? d : b.versionNo - a.versionNo;
  });
  return narrowed[0];
}
