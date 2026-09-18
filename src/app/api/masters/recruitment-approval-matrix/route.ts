import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { recruitmentApprovalMatrixSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('recruitmentApprovalMatrix', { searchFields: ['matrixCode','process'] });
export const POST = createHandler('recruitmentApprovalMatrix', recruitmentApprovalMatrixSchema, { uniqueField: 'matrixCode' });

