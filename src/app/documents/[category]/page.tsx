'use client';

import { useParams } from 'next/navigation';
import DocumentRepositoryPage from '@/components/documents/DocumentRepositoryPage';
import { slugToBusinessCategory } from '@/lib/platform/document/categories';

export default function DocumentCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = slugToBusinessCategory(String(params.category ?? ''));
  if (!category) {
    return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Unknown document category.</p>;
  }
  return <DocumentRepositoryPage lockedCategory={category} />;
}
