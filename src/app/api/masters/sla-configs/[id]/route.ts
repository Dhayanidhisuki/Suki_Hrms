import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { slaConfigSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('slaConfig');
export const PUT = createUpdateHandler('slaConfig', slaConfigSchema, { uniqueField: 'stageCode' });
export const DELETE = createDeleteHandler('slaConfig');

