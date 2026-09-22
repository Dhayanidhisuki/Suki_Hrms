import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { slaConfigSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('slaConfig', { searchFields: ['stageCode','stageName'] });
export const POST = createHandler('slaConfig', slaConfigSchema, { uniqueField: 'stageCode' });

