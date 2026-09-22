'use client';

import { ReactNode } from 'react';

interface KPIGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export default function KPIGrid({ children, columns = 3 }: KPIGridProps) {
  const colClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={`grid gap-4 ${colClass}`}>
      {children}
    </div>
  );
}
