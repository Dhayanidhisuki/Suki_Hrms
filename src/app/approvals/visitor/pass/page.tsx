import GatePassList from '@/components/visitor/GatePassList';

export default function VisitorPassApprovalPage() {
  return <GatePassList title="Visitor Pass Approval" subtitle="Visitor pass requests awaiting your approval" defaultStatus="PENDING_APPROVAL" primaryAction="none" showExport />;
}
