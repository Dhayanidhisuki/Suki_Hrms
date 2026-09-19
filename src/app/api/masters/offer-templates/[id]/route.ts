import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { offerTemplateSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('offerTemplate');
export const PUT = createUpdateHandler('offerTemplate', offerTemplateSchema, { uniqueField: 'templateCode' });
export const DELETE = createDeleteHandler('offerTemplate');

