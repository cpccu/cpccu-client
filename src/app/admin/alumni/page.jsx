import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { TablePageSkeleton } from '@/components/page-skeleton';

const AlumniContent = dynamic(
  () => import('@/components/alumni-content').then((module) => ({ default: module.AlumniContent })),
  { loading: () => <TablePageSkeleton /> }
);

export default function AlumniPage() {
  return (
    <AdminLayout>
      <AlumniContent />
    </AdminLayout>
  );
}
