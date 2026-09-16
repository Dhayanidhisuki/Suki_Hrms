import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { offerTemplateSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('offerTemplate', { searchFields: ['templateCode','templateName'] });
export const POST = createHandler('offerTemplate', offerTemplateSchema, { uniqueField: 'templateCode' });

