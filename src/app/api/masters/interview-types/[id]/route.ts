import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { interviewTypeSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('interviewType');
export const PUT = createUpdateHandler('interviewType', interviewTypeSchema, { uniqueField: 'typeCode' });
export const DELETE = createDeleteHandler('interviewType');

