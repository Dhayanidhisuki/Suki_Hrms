'use client';

import { useSearchParams } from 'next/navigation';
import RecruitmentTabs from '@/components/recruitment/RecruitmentTabs';
import { OFFER_JOINING_TABS, RECRUITMENT_PATHS, findRecruitmentTab } from '@/components/recruitment/tabDefs';
import FinalSelectionTab from '@/components/recruitment/FinalSelectionTab';
import OfferLetterTab from '@/components/recruitment/OfferLetterTab';
import AppointmentTab from '@/components/recruitment/AppointmentTab';
import JoiningTab from '@/components/recruitment/JoiningTab';
import StatutoryForm from '@/components/recruitment/StatutoryForm';
import OtherDocumentsTab from '@/components/recruitment/OtherDocumentsTab';

/**
 * Recruitment > Offer & Joining — final selection, offer letter, appointment
 * order, and joining workflow as tabs (BRD §16.4). Tab from ?tab= and ?sub=.
 */
export default function OfferJoiningPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? '';
  const sub = searchParams.get('sub') ?? '';
  const activeTab = findRecruitmentTab(OFFER_JOINING_TABS, tab).key;
  const activeSub = sub ? String(sub) : undefined;

  // Sub-tab content for the "joining" tab — keyed by sub-tab key.
  const joiningSubMap: Record<string, React.ReactNode> = {
    checklist: <JoiningTab />,
    'joining-approval': <JoiningTab />,
    'push-to-employee': <JoiningTab />,
    application: <StatutoryForm formType="joining-form" />,
    'joining-report': <StatutoryForm formType="joining-report" />,
    gratuity: <StatutoryForm formType="gratuity" />,
    pf: <StatutoryForm formType="pf" />,
    esi: <StatutoryForm formType="esi" />,
    insurance: <StatutoryForm formType="insurance" />,
    'other-documents': <OtherDocumentsTab />,
  };

  const contentMap: Record<string, React.ReactNode> = {
    selection: <FinalSelectionTab />,
    offer: <OfferLetterTab />,
    appointment: <AppointmentTab />,
    joining: <JoiningTab />,
  };

  return (
    <RecruitmentTabs
      title="Offer & Joining"
      subtitle="Final selection, offer letters, appointment orders and joining workflow."
      basePath={RECRUITMENT_PATHS.offerJoining}
      tabs={OFFER_JOINING_TABS}
      initialTab={activeTab}
      initialSub={activeSub}
      contentMap={contentMap}
      subContentMap={joiningSubMap}
    />
  );
}
