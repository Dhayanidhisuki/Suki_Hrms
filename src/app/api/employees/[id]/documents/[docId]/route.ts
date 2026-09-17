/**
 * DELETE /api/employees/[id]/documents/[docId] — disabled.
 * Platform documents are never hard-deleted; use withdraw/supersede instead.
 */

import { NextResponse } from 'next/server';

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Documents are not deleted. Upload a new version on the Documents tab, or withdraw a pending file.',
    },
    { status: 410 },
  );
}
