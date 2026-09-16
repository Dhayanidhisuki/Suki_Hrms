import { redirect } from 'next/navigation';
import { RECRUITMENT_PATHS } from '@/components/recruitment/tabDefs';

/** Recruitment home → Dashboard (first pipeline item). */
export default function RecruitmentHome() {
  redirect(RECRUITMENT_PATHS.dashboard);
}
