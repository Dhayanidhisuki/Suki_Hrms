'use client';

import { useState } from 'react';
import { Tabs } from '@/components/ui';
import ProgramsPage from '../training-programs/page';
import TrainersPage from '../trainers/page';
import VenuesPage from '../training-venues/page';
import QuestionBankPage from '../question-bank/page';
import ChecklistsPage from '../checklists/page';
import PoliciesPage from '../policies/page';
import BudgetsPage from '../budgets/page';
import DocumentsPage from '../documents/page';
import MentorsPage from '../mentors/page';
import ResourcesPage from '../resources/page';
import ProvidersPage from '../providers/page';
import CertificationsPage from '../certifications/page';
import MethodsPage from '../methods/page';

// Masters ordered by setup dependency: program → people → place → content → rules.
type TabKey = 'programs' | 'trainers' | 'mentors' | 'venues' | 'resources' | 'providers' | 'certifications' | 'methods' | 'questionBank' | 'checklists' | 'policies' | 'budgets' | 'documents';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'programs', label: 'Programs' },
  { key: 'trainers', label: 'Trainers' },
  { key: 'mentors', label: 'Mentors' },
  { key: 'venues', label: 'Venues' },
  { key: 'resources', label: 'Resources' },
  { key: 'providers', label: 'Providers' },
  { key: 'methods', label: 'Methods' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'questionBank', label: 'Question Bank' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'policies', label: 'Policies' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'documents', label: 'Documents' },
];

export default function LearningMastersPage() {
  const [tab, setTab] = useState<TabKey>('programs');

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'programs' && <ProgramsPage />}
      {tab === 'trainers' && <TrainersPage />}
      {tab === 'mentors' && <MentorsPage />}
      {tab === 'venues' && <VenuesPage />}
      {tab === 'resources' && <ResourcesPage />}
      {tab === 'providers' && <ProvidersPage />}
      {tab === 'certifications' && <CertificationsPage />}
      {tab === 'methods' && <MethodsPage />}
      {tab === 'questionBank' && <QuestionBankPage />}
      {tab === 'checklists' && <ChecklistsPage />}
      {tab === 'policies' && <PoliciesPage />}
      {tab === 'budgets' && <BudgetsPage />}
      {tab === 'documents' && <DocumentsPage />}
    </div>
  );
}
