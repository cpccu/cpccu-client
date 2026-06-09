'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { SettingsSkeleton } from '@/components/page-skeleton';
const SystemSettingsContent = dynamic(() => import('@/components/system-settings-content').then(m => ({ default: m.SystemSettingsContent })), { loading: () => <SettingsSkeleton /> });
export default function SystemSettingsPage() {
    return (<AdminLayout>
      <SystemSettingsContent />
    </AdminLayout>);
}
