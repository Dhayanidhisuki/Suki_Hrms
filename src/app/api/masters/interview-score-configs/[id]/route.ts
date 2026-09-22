import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { interviewScoreConfigSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('interviewScoreConfig', { softDelete: false });
export const PUT = createUpdateHandler('interviewScoreConfig', interviewScoreConfigSchema, { uniqueField: 'configCode', softDelete: false });
export const DELETE = createDeleteHandler('interviewScoreConfig', { softDelete: false });
