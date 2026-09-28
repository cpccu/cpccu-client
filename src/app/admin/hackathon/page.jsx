'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { SettingsSkeleton } from '@/components/page-skeleton';

// Majority convention (10 of 16 admin pages): dynamic import + a
// form-shaped skeleton, because this page is a form, not a card grid.
const HackathonContent = dynamic(
  () => import('@/components/hackathon-content').then(m => ({ default: m.HackathonContent })),
  { loading: () => <SettingsSkeleton /> }
);

export default function HackathonAdminPage() {
  return (
    <AdminLayout>
      <HackathonContent />
    </AdminLayout>
  );
}
