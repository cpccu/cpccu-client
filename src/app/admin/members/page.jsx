'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { TablePageSkeleton } from '@/components/page-skeleton';
const MembersContent = dynamic(() => import('@/components/members-content').then(m => ({ default: m.MembersContent })), { loading: () => <TablePageSkeleton /> });
export default function MembersPage() {
    return (<AdminLayout>
      <MembersContent />
    </AdminLayout>);
}
