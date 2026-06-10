import dynamic from 'next/dynamic';
import { TablePageSkeleton } from '@/components/page-skeleton';

const AuditLogsContent = dynamic(
  () => import('@/components/audit-logs-content').then((module) => ({ default: module.AuditLogsContent })),
  { loading: () => <TablePageSkeleton /> }
);

export default function AuditLogsPage() {
  return <AuditLogsContent />;
}
