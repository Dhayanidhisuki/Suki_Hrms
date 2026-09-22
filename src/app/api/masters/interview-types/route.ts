import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { interviewTypeSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('interviewType', { searchFields: ['typeCode','typeName'] });
export const POST = createHandler('interviewType', interviewTypeSchema, { uniqueField: 'typeCode' });

