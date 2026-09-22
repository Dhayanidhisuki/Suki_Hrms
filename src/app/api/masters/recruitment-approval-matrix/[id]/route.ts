import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { recruitmentApprovalMatrixSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('recruitmentApprovalMatrix');
export const PUT = createUpdateHandler('recruitmentApprovalMatrix', recruitmentApprovalMatrixSchema, { uniqueField: 'matrixCode' });
export const DELETE = createDeleteHandler('recruitmentApprovalMatrix');

