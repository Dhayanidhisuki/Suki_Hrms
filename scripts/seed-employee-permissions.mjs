/**
 * DEPRECATED — this script has been superseded.
 *
 * Permissions and roles are now seeded from a single canonical source:
 *   POST /api/auth/seed   (see src/app/api/auth/seed/route.ts)
 *
 * That endpoint seeds the full permission catalog (masters.*, employee.*,
 * admin.*) and the system-admin / hr-admin / hr-viewer roles in one
 * idempotent call. Run it instead, e.g.:
 *
 *   curl -X POST http://localhost:3000/api/auth/seed
 *
 * This file is kept in place (not deleted) so nothing that references its
 * path breaks, but its old seed logic has been removed to avoid two
 * divergent sources of truth for permissions.
 */

console.log('[seed-employee-permissions.mjs] Deprecated — no longer seeds anything.');
console.log('Permissions and roles are now seeded via POST /api/auth/seed.');
console.log('See src/app/api/auth/seed/route.ts.');
