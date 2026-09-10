/**
 * Server-generated sequential codes for simple master tables where the code
 * is a system id rather than something an admin should type (e.g. Employee
 * Type, Employee Category) — mirrors the Employee Code generator in
 * src/app/api/employees/route.ts.
 *
 * Scans ALL rows (including soft-deleted) since `code` stays globally
 * unique even after a soft delete — reusing a retired code would collide.
 */
export function nextSequentialCode(existingCodes: string[], prefix: string, pad = 3): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const code of existingCodes) {
    const m = code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(pad, '0')}`;
}
