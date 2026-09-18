import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { documentTypeSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('documentType', { searchFields: ['documentCode','documentName'] });
export const POST = createHandler('documentType', documentTypeSchema, { uniqueField: 'documentCode' });

