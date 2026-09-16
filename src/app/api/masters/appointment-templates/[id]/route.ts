/**
 * Appointment Template [id] — GET, PUT, DELETE (BRD §12.7 — P1).
 */

import { createGetHandler, createUpdateHandler, createDeleteHandler } from '@/lib/recruitment/crud-factory';
import { appointmentTemplateSchema } from '@/lib/validations/recruitment';

export const GET = createGetHandler('appointmentTemplate', {
  include: { department: true, designation: true },
});

export const PUT = createUpdateHandler('appointmentTemplate', appointmentTemplateSchema);

export const DELETE = createDeleteHandler('appointmentTemplate');
