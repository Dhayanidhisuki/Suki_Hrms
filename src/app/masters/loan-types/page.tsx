/**
 * Loan Master. KUN BRD review (2026-09-10): added Minimum/Maximum Slab —
 * the sanctionable amount range for this loan type.
 */

'use client';

import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function LoanTypesPage() {
  return (
    <SimpleMasterPage
      statsModule="loan-types"
      title="Loan Types"
      apiPath="/api/masters/loan-types"
      extraFields={[
        { name: 'minAmount', label: 'Minimum Slab', type: 'number', min: 0, placeholder: 'e.g. 5000' },
        { name: 'maxAmount', label: 'Maximum Slab', type: 'number', min: 0, placeholder: 'e.g. 100000' },
      ]}
      extraColumns={[
        {
          key: 'slab',
          label: 'Slab (Min / Max)',
          render: (row) => `${(row.minAmount as number | null) ?? '—'} / ${(row.maxAmount as number | null) ?? '—'}`,
        },
      ]}
      extraInitialValues={(row) => ({
        minAmount: (row.minAmount as number | null | undefined) ?? '',
        maxAmount: (row.maxAmount as number | null | undefined) ?? '',
      })}
    />
  );
}
