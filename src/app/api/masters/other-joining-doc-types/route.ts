/**
 * Other Joining Doc Type Master API (BRD §7.8).
 * Company-configurable master for miscellaneous joining documents.
 * GET  /api/masters/other-joining-doc-types
 * POST /api/masters/other-joining-doc-types
 */

import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { otherJoiningDocTypeSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('otherJoiningDocType', {
  searchFields: ['docCode', 'docName'],
});

export const POST = createHandler('otherJoiningDocType', otherJoiningDocTypeSchema, {
  uniqueField: 'docCode',
});
