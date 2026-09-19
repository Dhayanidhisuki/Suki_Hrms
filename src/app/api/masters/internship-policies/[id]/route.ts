import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { internshipPolicySchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('internshipPolicy');
export const PUT = createUpdateHandler('internshipPolicy', internshipPolicySchema, { uniqueField: 'policyCode' });
export const DELETE = createDeleteHandler('internshipPolicy');

