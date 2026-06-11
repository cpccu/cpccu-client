import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { TablePageSkeleton } from '@/components/page-skeleton';

const AuditLogsContent = dynamic(
  () => import('@/components/audit-logs-content').then((module) => ({ default: module.AuditLogsContent })),
  { loading: () => <TablePageSkeleton /> }
);

export default function AuditLogsPage() {
  return (
    <AdminLayout>
      <AuditLogsContent />
    </AdminLayout>
  );
}
