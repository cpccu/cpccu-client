'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { CardGridSkeleton } from '@/components/page-skeleton';
const GalleryContent = dynamic(() => import('@/components/gallery-content').then(m => ({ default: m.GalleryContent })), { loading: () => <CardGridSkeleton /> });
export default function GalleryPage() {
    return (<AdminLayout>
      <GalleryContent />
    </AdminLayout>);
}
