import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { checklistMasterSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('checklistMaster', { searchFields: ['itemCode','itemName'] });
export const POST = createHandler('checklistMaster', checklistMasterSchema, { uniqueField: 'itemCode' });

