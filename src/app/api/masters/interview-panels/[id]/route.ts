import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { interviewPanelSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('interviewPanel');
export const PUT = createUpdateHandler('interviewPanel', interviewPanelSchema, { uniqueField: 'panelCode' });
export const DELETE = createDeleteHandler('interviewPanel');

