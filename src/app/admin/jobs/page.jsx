'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { ProfileCardsSkeleton } from '@/components/page-skeleton';
const JobsContent = dynamic(() => import('@/components/jobs-content').then(m => ({ default: m.JobsContent })), { loading: () => <ProfileCardsSkeleton /> });
export default function JobsPage() {
    return (<AdminLayout>
      <JobsContent />
    </AdminLayout>);
}
