import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { joiningApprovalMatrixSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('joiningApprovalMatrix', { searchFields: ['matrixCode'] });
export const POST = createHandler('joiningApprovalMatrix', joiningApprovalMatrixSchema, { uniqueField: 'matrixCode' });

