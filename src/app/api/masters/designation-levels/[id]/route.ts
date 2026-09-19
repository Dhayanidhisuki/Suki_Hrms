import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { designationLevelSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('designationLevel');
export const PUT = createUpdateHandler('designationLevel', designationLevelSchema, { uniqueField: 'levelCode' });
export const DELETE = createDeleteHandler('designationLevel');

