import dynamic from 'next/dynamic';
import { TablePageSkeleton } from '@/components/page-skeleton';

const AlumniContent = dynamic(
  () => import('@/components/alumni-content').then((module) => ({ default: module.AlumniContent })),
  { loading: () => <TablePageSkeleton /> }
);

export default function AlumniPage() {
  return <AlumniContent />;
}
