import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { designationLevelSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('designationLevel', { searchFields: ['levelCode','levelName'] });
export const POST = createHandler('designationLevel', designationLevelSchema, { uniqueField: 'levelCode' });

