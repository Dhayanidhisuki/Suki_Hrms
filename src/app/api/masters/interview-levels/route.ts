import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { interviewLevelSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('interviewLevel', { searchFields: ['levelCode','levelName'] });
export const POST = createHandler('interviewLevel', interviewLevelSchema, { uniqueField: 'levelCode' });

