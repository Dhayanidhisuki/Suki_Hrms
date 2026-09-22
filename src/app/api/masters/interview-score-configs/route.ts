import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { interviewScoreConfigSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('interviewScoreConfig', { searchFields: ['configCode'], softDelete: false });
export const POST = createHandler('interviewScoreConfig', interviewScoreConfigSchema, { uniqueField: 'configCode', softDelete: false });
