import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { emailTemplateSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('emailTemplate');
export const PUT = createUpdateHandler('emailTemplate', emailTemplateSchema, { uniqueField: 'templateCode' });
export const DELETE = createDeleteHandler('emailTemplate');

