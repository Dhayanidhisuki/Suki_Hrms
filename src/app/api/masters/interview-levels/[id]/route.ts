import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { interviewLevelSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('interviewLevel');
export const PUT = createUpdateHandler('interviewLevel', interviewLevelSchema, { uniqueField: 'levelCode' });
export const DELETE = createDeleteHandler('interviewLevel');

