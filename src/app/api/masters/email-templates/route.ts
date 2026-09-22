import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { emailTemplateSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('emailTemplate', { searchFields: ['templateCode','templateName','event'] });
export const POST = createHandler('emailTemplate', emailTemplateSchema, { uniqueField: 'templateCode' });

