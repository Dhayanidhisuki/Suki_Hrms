import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { checklistMasterSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('checklistMaster');
export const PUT = createUpdateHandler('checklistMaster', checklistMasterSchema, { uniqueField: 'itemCode' });
export const DELETE = createDeleteHandler('checklistMaster');

