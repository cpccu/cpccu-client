import dynamic from 'next/dynamic';
import { TableSkeleton } from '@/components/page-skeleton';

const AlumniContent = dynamic(
  () => import('@/components/alumni-content').then((module) => ({ default: module.AlumniContent })),
  { loading: () => <TableSkeleton /> }
);

export default function AlumniPage() {
  return <AlumniContent />;
}
