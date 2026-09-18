import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { recruitmentStatusSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('recruitmentStatus', { searchFields: ['statusCode','statusName'], softDelete: false });
export const POST = createHandler('recruitmentStatus', recruitmentStatusSchema, { uniqueField: 'statusCode', softDelete: false });
