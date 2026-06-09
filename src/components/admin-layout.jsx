'use client';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
const routeLabels = {
    '/admin': 'Dashboard',
    '/admin/certificates': 'Certificates',
    '/admin/contributors': 'Contributors',
    '/admin/donators': 'Donators',
    '/admin/posts': 'Posts',
    '/admin/members': 'Members',
    '/admin/events': 'Events',
    '/admin/gallery': 'Gallery',
    '/admin/jobs': 'Job Pipeline',
    '/admin/messages': 'Contact Messages',
    '/admin/settings/account': 'Account Settings',
    '/admin/settings/system': 'System Settings',
    '/admin/statistics': 'Site Statistics',
};
const adminRoles = ['admin', 'moderator', 'mentor'];
export default function AdminLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { hydrated, user } = useSelector((state) => state.auth);
    const currentLabel = routeLabels[pathname] || 'Dashboard';
    useEffect(() => {
        if (hydrated && !user) {
            router.replace('/login');
        }
    }, [hydrated, router, user]);
    if (!hydrated) {
        return <p className="p-6 text-muted-foreground">Loading admin access...</p>;
    }
    if (!user) {
        return null;
    }
    if (!adminRoles.includes(user.roles?.role)) {
        return (<main className="flex min-h-svh items-center justify-center bg-background p-6">
        <section className="w-full max-w-lg rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-muted-foreground">Only verified CPCCU administrators can open this panel.</p>
          <BreadcrumbLink href="/" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground">
            Return to website
          </BreadcrumbLink>
        </section>
      </main>);
    }
    return (<SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
          <SidebarTrigger className="-ml-1"/>
          <Separator orientation="vertical" className="mr-2 h-4"/>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
              </BreadcrumbItem>
              {currentLabel !== 'Dashboard' && (<>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>)}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>);
}
