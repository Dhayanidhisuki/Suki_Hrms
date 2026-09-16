import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { sourcingChannelSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('sourcingChannel');
export const PUT = createUpdateHandler('sourcingChannel', sourcingChannelSchema, { uniqueField: 'channelCode' });
export const DELETE = createDeleteHandler('sourcingChannel');

