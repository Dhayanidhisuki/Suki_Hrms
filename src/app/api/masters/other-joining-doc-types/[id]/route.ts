/**
 * Other Joining Doc Type [id] — GET, PUT, DELETE (BRD §7.8).
 */

import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { otherJoiningDocTypeSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('otherJoiningDocType');
export const PUT = createUpdateHandler('otherJoiningDocType', otherJoiningDocTypeSchema);
export const DELETE = createDeleteHandler('otherJoiningDocType');
