'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { SettingsSkeleton } from '@/components/page-skeleton';
const AccountSettingsContent = dynamic(() => import('@/components/account-settings-content').then(m => ({ default: m.AccountSettingsContent })), { loading: () => <SettingsSkeleton /> });
export default function AccountSettingsPage() {
    return (<AdminLayout>
      <AccountSettingsContent />
    </AdminLayout>);
}
