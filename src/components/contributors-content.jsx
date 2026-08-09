'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, Edit2, GitCommit, RefreshCw, Users, ShieldCheck, Info, ExternalLink, UserX } from 'lucide-react';
import { FaGithub as Github, FaLinkedin as Linkedin } from 'react-icons/fa';
import contributorsData from '@/data/contributors.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { showErrorAlert, showSuccessAlert } from '@/lib/alerts';
import { extractGithubUsername } from '@/lib/public-content';
import { TablePageSkeleton } from '@/components/page-skeleton';
import { useGetAdminContributorsQuery, useUpdateContributorMetadataMutation, } from '@/features/admin/adminApi';

const getCommitCount = (contributor) => {
    if (typeof contributor?.commits === 'number') return contributor.commits;
    const match = String(contributor?.contribution || '').match(/(\d+)\s+commits?/i);
    return match ? parseInt(match[1], 10) : 0;
};

const toContributorRow = (contributor, index) => ({
    id: contributor.github || contributor.id || `${contributor.name || 'contributor'}-${index}`,
    name: contributor.name || 'Unknown',
    username: extractGithubUsername(contributor.github) || '',
    github: contributor.github || '',
    avatar: contributor.avatar || contributor.avatarUrl || '',
    batch: contributor.batch || '',
    linkedin: contributor.linkedin || contributor.linkedinUrl || '',
    role: contributor.role || 'Contributor',
    commitCount: getCommitCount(contributor),
    contribution: contributor.contribution || `Contributed ${getCommitCount(contributor)} commits to the project`,
});

const emptyForm = { batch: '', linkedin: '' };

// Read-only display field for GitHub-synced data — visually distinct from editable inputs.
const ReadOnlyField = ({ label, value, className = '' }) => (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex h-9 min-w-0 items-center rounded-md border border-dashed bg-muted/40 px-3 text-sm text-muted-foreground">
            <span className="truncate">{value || '—'}</span>
        </div>
    </div>
);

export function ContributorsContent() {
    const { data: contributorsResponse, isLoading, isError, refetch, isFetching } = useGetAdminContributorsQuery();
    const [updateContributorMetadata, { isLoading: isSaving }] = useUpdateContributorMetadataMutation();
    const [rows, setRows] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingContributor, setEditingContributor] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    // Same source that powers the public Contributors page: prefer the live
    // data/contributors.json from GitHub (served by the backend), fall back to
    // the bundled copy when the live fetch is unavailable.
    const contributors = useMemo(() => {
        if (isLoading) return null;
        const items = contributorsResponse?.data;
        return Array.isArray(items) && items.length ? items : contributorsData;
    }, [contributorsResponse, isLoading]);

    useEffect(() => {
        if (contributors) setRows(contributors.map(toContributorRow));
    }, [contributors]);

    const filteredContributors = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((c) =>
            [c.name, c.username, c.batch, c.linkedin, c.role]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(query))
        );
    }, [rows, searchQuery]);

    const stats = useMemo(() => {
        const totalCommits = rows.reduce((sum, c) => sum + (c.commitCount || 0), 0);
        const topContributor = rows.length
            ? rows.reduce((best, c) => (c.commitCount > best.commitCount ? c : best), rows[0])
            : null;
        return {
            totalContributors: rows.length,
            totalCommits,
            avgCommits: rows.length ? Math.round(totalCommits / rows.length) : 0,
            topContributor,
        };
    }, [rows]);

    const handleOpenEdit = (contributor) => {
        setEditingContributor(contributor);
        setFormData({ batch: contributor.batch || '', linkedin: contributor.linkedin || '' });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!editingContributor) return;
        const batch = formData.batch.trim();
        const linkedin = formData.linkedin.trim();
        try {
            await updateContributorMetadata({
                githubUsername: editingContributor.username,
                body: { batch, linkedin },
            }).unwrap();
            setRows((current) =>
                current.map((c) => (c.id === editingContributor.id ? { ...c, batch, linkedin } : c))
            );
            setDialogOpen(false);
            showSuccessAlert(
                'Saved!',
                'Batch & LinkedIn updated. The change is written to data/contributors.json and appears on the public page after the next deploy.'
            );
        } catch (err) {
            const data = err?.data || {};
            const message = Array.isArray(data.error) && data.error[0]?.message
                ? data.error[0].message
                : data.message;
            showErrorAlert(
                'Save failed',
                message || 'Could not update the contributor. Check that the server has CONTRIBUTOR_GITHUB_TOKEN configured.'
            );
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Contributors Management</h1>
                    <p className="text-muted-foreground">Loading contributors from GitHub…</p>
                </div>
                <TablePageSkeleton />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Contributors Management</h1>
                    <p className="text-muted-foreground">
                        Contributors are synced automatically from GitHub by the daily workflow. Only Batch and LinkedIn are editable.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                        <Github className="size-3.5" />
                        GitHub-synced
                    </Badge>
                    <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching}>
                        <RefreshCw className={`mr-2 size-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {isError && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <div>
                        <p className="font-medium">Live sync unavailable</p>
                        <p className="text-amber-700">
                            Could not fetch the latest contributors from GitHub. Showing the bundled data instead — it may not reflect recent commits.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total Contributors</span>
                            <Users className="size-4 text-muted-foreground" />
                        </div>
                        <p className="mt-1 text-2xl font-bold">{stats.totalContributors}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total Commits</span>
                            <GitCommit className="size-4 text-muted-foreground" />
                        </div>
                        <p className="mt-1 text-2xl font-bold">{stats.totalCommits}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Avg Commits</span>
                            <GitCommit className="size-4 text-muted-foreground" />
                        </div>
                        <p className="mt-1 text-2xl font-bold">{stats.avgCommits}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Top Contributor</span>
                            <ShieldCheck className="size-4 text-muted-foreground" />
                        </div>
                        <p className="mt-1 truncate text-lg font-bold" title={stats.topContributor?.name || '-'}>
                            {stats.topContributor?.name || '-'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Contributors List</CardTitle>
                    <CardDescription>
                        People who contributed to the CPCCU platform. GitHub information is read-only and managed by the GitHub Action.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, GitHub username, batch, or LinkedIn…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Contributor</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Commits</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Links</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-12">
                                            <div className="flex flex-col items-center gap-2 text-center">
                                                <UserX className="size-8 text-muted-foreground" />
                                                <p className="font-medium">No contributors yet</p>
                                                <p className="max-w-sm text-sm text-muted-foreground">
                                                    Contributors appear here automatically once the GitHub Action syncs commits into data/contributors.json.
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredContributors.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                            No contributors match your search
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredContributors.map((contributor) => (
                                        <TableRow key={contributor.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="size-9">
                                                        <AvatarImage src={contributor.avatar} alt={contributor.name} />
                                                        <AvatarFallback>{(contributor.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium leading-tight">{contributor.name}</p>
                                                        <p className="text-xs text-muted-foreground">@{contributor.username || '—'}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">Contributor</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <GitCommit className="size-3.5 text-muted-foreground" />
                                                    <span className="font-medium">{contributor.commitCount}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {contributor.batch ? (
                                                    <Badge variant="outline">{contributor.batch}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {contributor.github && (
                                                        <Button variant="ghost" size="icon" className="size-7" asChild title="GitHub profile">
                                                            <a href={contributor.github} target="_blank" rel="noopener noreferrer">
                                                                <Github className="size-4" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {contributor.linkedin ? (
                                                        <Button variant="ghost" size="icon" className="size-7" asChild title="LinkedIn profile">
                                                            <a href={contributor.linkedin} target="_blank" rel="noopener noreferrer">
                                                                <Linkedin className="size-4" />
                                                            </a>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8"
                                                    onClick={() => handleOpenEdit(contributor)}
                                                    title="Edit Batch & LinkedIn"
                                                >
                                                    <Edit2 className="size-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
                    {editingContributor && (
                        <>
                            {/* Header — compact identity strip, always visible */}
                            <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
                                <div className="flex items-center gap-4">
                                    <Avatar className="size-20 shrink-0 border bg-muted/40">
                                        <AvatarImage src={editingContributor.avatar} alt={editingContributor.name} />
                                        <AvatarFallback className="text-lg">{(editingContributor.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <DialogTitle className="truncate text-lg">{editingContributor.name}</DialogTitle>
                                        <DialogDescription className="sr-only">Edit this contributor's Batch and LinkedIn information.</DialogDescription>
                                        <p className="mt-0.5 truncate text-sm text-muted-foreground">@{editingContributor.username || '—'}</p>
                                        <Badge variant="secondary" className="mt-2">Contributor</Badge>
                                    </div>
                                </div>
                            </DialogHeader>

                            {/* Scrollable body — header and footer stay fixed */}
                            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                                <section aria-label="GitHub Information" className="rounded-lg border bg-muted/30 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <div>
                                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                                                <Github className="size-4 text-muted-foreground" />
                                                GitHub Information
                                            </h3>
                                            <p className="mt-0.5 text-xs text-muted-foreground">Automatically synced from GitHub</p>
                                        </div>
                                        <Badge variant="secondary" className="shrink-0 gap-1">
                                            <ShieldCheck className="size-3" />
                                            Auto-synced
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <ReadOnlyField label="Name" value={editingContributor.name} />
                                        <ReadOnlyField label="GitHub Username" value={`@${editingContributor.username || ''}`} />
                                        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                                            <span className="text-xs font-medium text-muted-foreground">GitHub Profile</span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-dashed bg-muted/40 px-3 text-sm text-muted-foreground">
                                                    <span className="truncate">{editingContributor.github || '—'}</span>
                                                </div>
                                                {editingContributor.github && (
                                                    <Button variant="outline" size="icon" className="size-9 shrink-0" asChild title="Open GitHub profile">
                                                        <a href={editingContributor.github} target="_blank" rel="noopener noreferrer" aria-label="Open GitHub profile">
                                                            <ExternalLink className="size-4" />
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <ReadOnlyField className="sm:col-span-2" label="Contributions" value={editingContributor.contribution} />
                                    </div>
                                </section>

                                <section aria-label="CPCCU Information" className="rounded-lg border p-4">
                                    <div className="mb-3">
                                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                                            <Users className="size-4 text-muted-foreground" />
                                            CPCCU Information
                                        </h3>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Managed by CPCCU Admin</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="contributor-batch" className="text-xs font-medium text-muted-foreground">Batch</Label>
                                            <Input
                                                id="contributor-batch"
                                                value={formData.batch}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, batch: e.target.value }))}
                                                placeholder="e.g. 67th"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="contributor-linkedin" className="text-xs font-medium text-muted-foreground">LinkedIn URL</Label>
                                            <Input
                                                id="contributor-linkedin"
                                                type="url"
                                                value={formData.linkedin}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, linkedin: e.target.value }))}
                                                placeholder="https://linkedin.com/in/username"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                                            <span className="text-xs font-medium text-muted-foreground">Role</span>
                                            <div className="flex h-10 items-center justify-between rounded-md border bg-muted/40 px-3">
                                                <span className="text-sm font-medium">Contributor</span>
                                                <Badge variant="secondary" className="gap-1">
                                                    <ShieldCheck className="size-3" />
                                                    Fixed
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Role is automatically assigned to contributors.</p>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Footer — always visible */}
                            <DialogFooter className="border-t px-6 py-4 sm:flex-row">
                                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={isSaving || !editingContributor?.username}>
                                    {isSaving ? (
                                        <>
                                            <RefreshCw className="mr-2 size-4 animate-spin" />
                                            Saving…
                                        </>
                                    ) : (
                                        'Save Changes'
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
