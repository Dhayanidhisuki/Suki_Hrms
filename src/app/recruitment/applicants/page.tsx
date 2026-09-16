'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RecruitmentTabs from '@/components/recruitment/RecruitmentTabs';
import { APPLICANT_TABS, RECRUITMENT_PATHS, findRecruitmentTab } from '@/components/recruitment/tabDefs';
import PipelineTab from '@/components/recruitment/PipelineTab';
import NewApplicantTab from '@/components/recruitment/NewApplicantTab';
import CallInterviewTab from '@/components/recruitment/CallInterviewTab';
import Candidate360Tab from '@/components/recruitment/Candidate360Tab';

/**
 * Recruitment > Applicants — pipeline, registration, Candidate 360° and call
 * interview as tabs on one page (BRD §16.4). Tab is read from ?tab=.
 */
function ApplicantsPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? '';
  const activeTab = findRecruitmentTab(APPLICANT_TABS, tab).key;

  const contentMap: Record<string, React.ReactNode> = {
    pipeline: <PipelineTab />,
    'new-applicant': <NewApplicantTab />,
    'candidate-360': <Candidate360Tab />,
    'call-interview': <CallInterviewTab />,
  };

  return (
    <RecruitmentTabs
      title="Applicants"
      subtitle="Candidate pipeline, registration, 360° profile and call screening."
      basePath={RECRUITMENT_PATHS.applicants}
      tabs={APPLICANT_TABS}
      initialTab={activeTab}
      contentMap={contentMap}
    />
  );
}

export default function ApplicantsPage() {
  return (
    <Suspense fallback={null}>
      <ApplicantsPageContent />
    </Suspense>
  );
}
