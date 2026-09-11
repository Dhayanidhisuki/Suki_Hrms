/**
 * GET /api/masters/jd-master/sample-pdf — a fillable-style JD document
 * (title, description, roles, work, skills) to attach as the JD file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { checkMasterPermission } from '@/lib/rbac-masters';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.16, 0.22);
  const muted = rgb(0.4, 0.45, 0.5);
  let y = 800;

  const heading = (text: string) => {
    page.drawText(text, { x: 50, y, size: 13, font: bold, color: ink });
    y -= 8;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.6, color: rgb(0.8, 0.82, 0.85) });
    y -= 18;
  };
  const line = (text: string) => {
    page.drawText(text, { x: 50, y, size: 10, font, color: muted });
    y -= 16;
  };

  page.drawText('JOB DESCRIPTION', { x: 50, y, size: 20, font: bold, color: ink });
  y -= 28;
  page.drawText('Fill this document and upload it on JD Master (PDF / Word).', { x: 50, y, size: 9, font, color: muted });
  y -= 28;

  heading('1. Title');
  line('Job title: ________________________________');
  y -= 8;
  heading('2. Department & Designation');
  line('Department: ________________    Designation: ________________');
  y -= 8;
  heading('3. Description');
  line('Summarise the purpose of this role.');
  line('________________________________________________________________');
  line('________________________________________________________________');
  y -= 8;
  heading('4. Roles & responsibilities');
  line('• Role 1: ________________________________________________');
  line('• Role 2: ________________________________________________');
  line('• Role 3: ________________________________________________');
  line('• Role 4: ________________________________________________');
  y -= 8;
  heading('5. Work / key activities');
  line('• Daily / weekly work: ____________________________________');
  line('• Machines / tools / systems: _____________________________');
  line('• Reporting & coordination: _______________________________');
  y -= 8;
  heading('6. Skills');
  line('Technical: ________________________________________________');
  line('Soft skills: ______________________________________________');
  y -= 8;
  heading('7. Experience & salary package');
  line('Min years: ______    Max years: ______    Package: ________');

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="jd-document-template.pdf"',
    },
  });
}
