import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { interviewCriteriaSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('interviewCriteria');
export const PUT = createUpdateHandler('interviewCriteria', interviewCriteriaSchema, { uniqueField: 'criteriaCode' });
export const DELETE = createDeleteHandler('interviewCriteria');

