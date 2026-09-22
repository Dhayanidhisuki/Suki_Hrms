import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { joiningApprovalMatrixSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('joiningApprovalMatrix');
export const PUT = createUpdateHandler('joiningApprovalMatrix', joiningApprovalMatrixSchema, { uniqueField: 'matrixCode' });
export const DELETE = createDeleteHandler('joiningApprovalMatrix');

