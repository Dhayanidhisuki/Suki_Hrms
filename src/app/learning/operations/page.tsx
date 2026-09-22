'use client';

import { useState } from 'react';
import { Tabs } from '@/components/ui';
import TrainingNeedsPage from '../training-needs/page';
import NominationsPage from '../nominations/page';
import AssessmentsPage from '../assessments/page';
import EffectivenessPage from '../effectiveness/page';
import CertificatesPage from '../certificates/page';
import InductionPage from '../induction/page';
import OjtPage from '../ojt/page';
import CompliancePage from '../compliance/page';
import ExternalPage from '../external/page';
import IdpPage from '../idp/page';
import RecommendationsPage from '../recommendations/page';

// Tabs follow the BRD lifecycle order:
// gap → need → nomination → assessment → effectiveness → certificate.
type TabKey = 'needs' | 'nominations' | 'assessments' | 'effectiveness' | 'certificates' | 'induction' | 'ojt' | 'compliance' | 'external' | 'idp' | 'recommendations';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'needs', label: 'Training Needs' },
  { key: 'nominations', label: 'Nominations' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'effectiveness', label: 'Effectiveness' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'induction', label: 'Induction' },
  { key: 'ojt', label: 'OJT' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'external', label: 'External' },
  { key: 'idp', label: 'IDP' },
  { key: 'recommendations', label: 'Recommendations' },
];

export default function TrainingOperationsPage() {
  const [tab, setTab] = useState<TabKey>('needs');

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'needs' && <TrainingNeedsPage />}
      {tab === 'nominations' && <NominationsPage />}
      {tab === 'assessments' && <AssessmentsPage />}
      {tab === 'effectiveness' && <EffectivenessPage />}
      {tab === 'certificates' && <CertificatesPage />}
      {tab === 'induction' && <InductionPage />}
      {tab === 'ojt' && <OjtPage />}
      {tab === 'compliance' && <CompliancePage />}
      {tab === 'external' && <ExternalPage />}
      {tab === 'idp' && <IdpPage />}
      {tab === 'recommendations' && <RecommendationsPage />}
    </div>
  );
}
