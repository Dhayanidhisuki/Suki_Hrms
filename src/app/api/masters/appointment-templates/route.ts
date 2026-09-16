/**
 * Appointment Template Master API (BRD §12.7 — P1).
 * GET  /api/masters/appointment-templates
 * POST /api/masters/appointment-templates
 */

import { createListHandler, createHandler } from '@/lib/recruitment/crud-factory';
import { appointmentTemplateSchema } from '@/lib/validations/recruitment';

export const GET = createListHandler('appointmentTemplate', {
  searchFields: ['templateCode', 'templateName'],
  include: { department: true, designation: true },
});

export const POST = createHandler('appointmentTemplate', appointmentTemplateSchema, {
  uniqueField: 'templateCode',
});
