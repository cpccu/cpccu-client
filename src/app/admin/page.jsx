'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { DashboardSkeleton } from '@/components/page-skeleton';
const DashboardContent = dynamic(() => import('@/components/dashboard-content').then(m => ({ default: m.DashboardContent })), { loading: () => <DashboardSkeleton /> });
export default function AdminDashboardPage() {
    return (<AdminLayout>
      <DashboardContent />
    </AdminLayout>);
}
