import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { bgvStepSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('bgvStep');
export const PUT = createUpdateHandler('bgvStep', bgvStepSchema, { uniqueField: 'stepCode' });
export const DELETE = createDeleteHandler('bgvStep');

