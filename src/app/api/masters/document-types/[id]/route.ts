import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { documentTypeSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('documentType');
export const PUT = createUpdateHandler('documentType', documentTypeSchema, { uniqueField: 'documentCode' });
export const DELETE = createDeleteHandler('documentType');

