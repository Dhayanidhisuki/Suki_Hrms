import { redirect } from 'next/navigation';

/** Split back into separate Designations / Grades pages (2026-09-21) — keep old links working. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = await searchParams;
  redirect(tab === 'grades' ? '/masters/grades' : '/masters/designations');
}
