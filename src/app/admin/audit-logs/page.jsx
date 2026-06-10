import dynamic from 'next/dynamic';
import { TableSkeleton } from '@/components/page-skeleton';

const AuditLogsContent = dynamic(
  () => import('@/components/audit-logs-content').then((module) => ({ default: module.AuditLogsContent })),
  { loading: () => <TableSkeleton /> }
);

export default function AuditLogsPage() {
  return <AuditLogsContent />;
}
