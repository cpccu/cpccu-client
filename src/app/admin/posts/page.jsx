'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';
import { TablePageSkeleton } from '@/components/page-skeleton';
const PostsContent = dynamic(() => import('@/components/posts-content').then(m => ({ default: m.PostsContent })), { loading: () => <TablePageSkeleton /> });
export default function PostsPage() {
    return (<AdminLayout>
      <PostsContent />
    </AdminLayout>);
}
