'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RecruitmentTabs from '@/components/recruitment/RecruitmentTabs';
import { INTERVIEW_TABS, RECRUITMENT_PATHS, findRecruitmentTab } from '@/components/recruitment/tabDefs';
import SchedulingTab from '@/components/recruitment/SchedulingTab';
import MyInterviewsTab from '@/components/recruitment/MyInterviewsTab';
import EvaluationTab from '@/components/recruitment/EvaluationTab';
import DocVerificationTab from '@/components/recruitment/DocVerificationTab';

/**
 * Recruitment > Interviews — scheduling, interviewer queue, evaluation
 * scorecards and document verification as tabs (BRD §16.4). Tab from ?tab=.
 */
function InterviewsPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? '';
  const activeTab = findRecruitmentTab(INTERVIEW_TABS, tab).key;

  const contentMap: Record<string, React.ReactNode> = {
    scheduling: <SchedulingTab />,
    'my-interviews': <MyInterviewsTab />,
    evaluation: <EvaluationTab />,
    verification: <DocVerificationTab />,
  };

  return (
    <RecruitmentTabs
      title="Interviews"
      subtitle="Scheduling, interviewer queue, evaluation scorecards and document verification."
      basePath={RECRUITMENT_PATHS.interviews}
      tabs={INTERVIEW_TABS}
      initialTab={activeTab}
      contentMap={contentMap}
    />
  );
}

export default function InterviewsPage() {
  return (
    <Suspense fallback={null}>
      <InterviewsPageContent />
    </Suspense>
  );
}
