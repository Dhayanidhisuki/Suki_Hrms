import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { bgvStepSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('bgvStep', { searchFields: ['stepCode','stepName'] });
export const POST = createHandler('bgvStep', bgvStepSchema, { uniqueField: 'stepCode' });

