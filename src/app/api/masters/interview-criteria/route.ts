import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { interviewCriteriaSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('interviewCriteria', { searchFields: ['criteriaCode','criteriaName'] });
export const POST = createHandler('interviewCriteria', interviewCriteriaSchema, { uniqueField: 'criteriaCode' });

