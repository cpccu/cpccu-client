'use client';
import { Users, Image, Calendar, Eye, FileCheck, Trophy, BarChart3, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetAdminStatisticsQuery } from '@/features/admin/adminApi';
const statConfigs = [
    { key: 'members', label: 'Total Members', icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { key: 'photos', label: 'Gallery Photos', icon: Image, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { key: 'events', label: 'Total Events', icon: Calendar, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { key: 'totalVisitors', label: 'Total Visitors', icon: Eye, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
    { key: 'certificatesIssued', label: 'Certificates Issued', icon: FileCheck, color: 'text-teal-500', bgColor: 'bg-teal-500/10' },
    { key: 'certificateVerifications', label: 'Certificate Verifications', icon: Eye, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    { key: 'failedCertificateVerifications', label: 'Failed Verifications', icon: Eye, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { key: 'contestsHeld', label: 'Contests Held', icon: Trophy, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { key: 'winnersRecognized', label: 'Winners Recognized', icon: BarChart3, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
];
export function StatisticsContent() {
    const { data: statisticsResponse, isLoading, isError, refetch, isFetching } = useGetAdminStatisticsQuery();
    const stats = statisticsResponse?.data;
    const renderStatGrid = (showSkeleton = false) => (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {showSkeleton
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-9 w-16" />
                                </div>
                                <Skeleton className="size-9 rounded-lg" />
                            </div>
                        </CardContent>
                    </Card>
                ))
                : statConfigs.map((config) => {
                    const Icon = config.icon;
                    const value = stats?.[config.key] ?? 0;
                    return (
                        <Card key={config.key}>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-muted-foreground">{config.label}</span>
                                        <span className="text-3xl font-bold">{Number(value).toLocaleString()}</span>
                                    </div>
                                    <div className={`rounded-lg p-2 ${config.bgColor}`}>
                                        <Icon className={`size-5 ${config.color}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
        </div>
    );
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Site Statistics</h1>
                    <p className="text-muted-foreground">
                        Live statistics calculated automatically from the CPCCU website data.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                        <ShieldCheck className="size-3.5" />
                        Auto-calculated
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
                        <p className="font-medium">Unable to load statistics</p>
                        <p className="text-amber-700">
                            The statistics could not be fetched from the server. Please try again.
                        </p>
                    </div>
                </div>
            )}

            {isLoading ? renderStatGrid(true) : renderStatGrid(false)}

            <Card>
                <CardHeader>
                    <CardTitle>Statistics Overview</CardTitle>
                    <CardDescription>
                        These numbers are derived in real time from the actual CPCCU system — members, gallery,
                        events, the visitor counter, certificates, and certificate verification records. There is
                        nothing to edit manually.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="mb-3 font-semibold">Homepage Stats</h3>
                            <p className="text-sm text-muted-foreground">
                                The Members, Photos, and Events counts reflect the same data shown across the public
                                website.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Members: {Number(stats?.members ?? 0).toLocaleString()}</div>
                                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Photos: {Number(stats?.photos ?? 0).toLocaleString()}</div>
                                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Events: {Number(stats?.events ?? 0).toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="mb-3 font-semibold">Certificate Page Stats</h3>
                            <p className="text-sm text-muted-foreground">
                                The certificate page shows certificates issued, contests held, and winners recognized
                                from the certificate records.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Certificates: {Number(stats?.certificatesIssued ?? 0).toLocaleString()}</div>
                                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Contests: {Number(stats?.contestsHeld ?? 0).toLocaleString()}</div>
                                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Winners: {Number(stats?.winnersRecognized ?? 0).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                        Total Visitors matches the homepage visitor counter, and the verification counters come from
                        the certificate verification logs. All values update automatically as the underlying data
                        changes.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
