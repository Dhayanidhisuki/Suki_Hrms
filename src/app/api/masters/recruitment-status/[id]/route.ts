import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { recruitmentStatusSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('recruitmentStatus', { softDelete: false });
export const PUT = createUpdateHandler('recruitmentStatus', recruitmentStatusSchema, { uniqueField: 'statusCode', softDelete: false });
export const DELETE = createDeleteHandler('recruitmentStatus', { softDelete: false });
