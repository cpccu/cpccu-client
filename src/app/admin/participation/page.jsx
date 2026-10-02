'use client';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin-layout';

/**
 * `/admin/participation` — the registration and submission review surface.
 *
 * ⚠️ `dynamic()` BECAUSE EVERY OTHER ADMIN PAGE DOES IT. The panel is a large
 * client component with three RTK Query hooks and no server value at all, so there
 * is nothing in it to render on the server; loading it through `next/dynamic`
 * keeps it out of the bundle for every OTHER admin page. Matching the existing
 * shape rather than importing it directly is deliberate — a lone direct import
 * would be the first admin page that ships its whole tree to every admin route.
 *
 * ⚠️ `ssr: false` IS NOT SET, and that is deliberate too. The other admin pages
 * omit it as well, and adding it here alone would make this the only page whose
 * admin shell renders differently on first paint — which is a difference nobody
 * would notice until it caused a hydration mismatch. The component is already
 * safe to render on the server: it reads the Redux store (which
 * `ProviderWrapper` hydrates before children paint) and issues queries that
 * resolve client-side.
 *
 * ⚠️ THE ROLE GATE IS IN THE COMPONENT, NOT HERE. `AdminLayout` admits
 * `['admin', 'moderator', 'mentor']`, and this page's data is read-available to
 * admins and moderators only. Adding a second gate in this file would be a second
 * rule that could disagree with the one in `ParticipationContent` — so the page
 * renders and the component decides, exactly as every other admin content page
 * does.
 */
const ParticipationContent = dynamic(
    () => import('@/components/participation-content').then((m) => ({ default: m.ParticipationContent })),
    { loading: () => <div className="p-6 text-muted-foreground">Loading participation review…</div> }
);

export default function ParticipationPage() {
    return (
        <AdminLayout>
            <ParticipationContent />
        </AdminLayout>
    );
}
