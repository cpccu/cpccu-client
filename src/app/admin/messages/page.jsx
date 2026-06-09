import AdminLayout from '@/components/admin-layout';
import { MessagesContent } from '@/components/messages-content';
export const metadata = {
    title: 'Contact Messages | CPCCU Admin',
    description: 'Manage contact form messages and inquiries',
};
export default function MessagesPage() {
    return (<AdminLayout>
      <MessagesContent />
    </AdminLayout>);
}
