import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { sourcingChannelSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('sourcingChannel', { searchFields: ['channelCode','channelName'] });
export const POST = createHandler('sourcingChannel', sourcingChannelSchema, { uniqueField: 'channelCode' });

