import EmployeeMastersTabs from '@/components/masters/EmployeeMastersTabs';
import { isEmployeeMasterTab } from '@/components/masters/employeeMasterTabs';

export default async function EmployeeMastersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = await searchParams;
  return <EmployeeMastersTabs initialTab={isEmployeeMasterTab(tab) ? tab : 'designations'} />;
}
