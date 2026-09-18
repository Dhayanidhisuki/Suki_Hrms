import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { internshipPolicySchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('internshipPolicy', { searchFields: ['policyCode','policyName'] });
export const POST = createHandler('internshipPolicy', internshipPolicySchema, { uniqueField: 'policyCode' });

