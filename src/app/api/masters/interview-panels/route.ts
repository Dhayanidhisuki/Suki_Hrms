import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { interviewPanelSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('interviewPanel', { searchFields: ['panelCode'] });
export const POST = createHandler('interviewPanel', interviewPanelSchema, { uniqueField: 'panelCode' });

