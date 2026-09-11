import GatePassList from '@/components/visitor/GatePassList';

export default function CurrentInsideReportPage() {
  return <GatePassList title="Current Inside" subtitle="Visitors currently on premises" defaultStatus="CHECKED_IN" primaryAction="none" readOnly showExport />;
}
