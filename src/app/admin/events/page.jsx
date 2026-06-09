'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { CardGridSkeleton } from '@/components/page-skeleton';
const EventsContent = dynamic(() => import('@/components/events-content').then(m => ({ default: m.EventsContent })), { loading: () => <CardGridSkeleton /> });
export default function EventsPage() {
    return (<AdminLayout>
      <EventsContent />
    </AdminLayout>);
}
