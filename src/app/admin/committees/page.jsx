import AdminLayout from '@/components/admin-layout';
import { CommitteeContent } from '@/components/committee-content';

export const metadata = {
  title: 'Committees | CPCCU Admin',
};

export default function AdminCommitteesPage() {
  return (
    <AdminLayout>
      <CommitteeContent />
    </AdminLayout>
  );
}
