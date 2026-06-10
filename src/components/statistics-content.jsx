'use client';
import { useEffect, useState } from 'react';
import { Users, Image, Calendar, Award, Eye, Trophy, FileCheck, BarChart3, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccessAlert } from '@/lib/alerts';
import { useGetAdminStatisticsQuery, useUpdateAdminStatisticsMutation } from '@/features/admin/adminApi';
const statConfigs = [
    { key: 'members', label: 'Total Members', icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { key: 'photos', label: 'Gallery Photos', icon: Image, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { key: 'events', label: 'Total Events', icon: Calendar, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { key: 'awards', label: 'Total Awards', icon: Award, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { key: 'totalVisitors', label: 'Total Visitors', icon: Eye, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
    { key: 'certificatesIssued', label: 'Certificates Issued', icon: FileCheck, color: 'text-teal-500', bgColor: 'bg-teal-500/10' },
    { key: 'certificateVerifications', label: 'Certificate Verifications', icon: Eye, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    { key: 'failedCertificateVerifications', label: 'Failed Verifications', icon: Eye, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { key: 'contestsHeld', label: 'Contests Held', icon: Trophy, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { key: 'winnersRecognized', label: 'Winners Recognized', icon: BarChart3, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
];
const emptyStatistics = {
    members: 0,
    photos: 0,
    events: 0,
    awards: 0,
    totalVisitors: 0,
    certificatesIssued: 0,
    certificateVerifications: 0,
    failedCertificateVerifications: 0,
    contestsHeld: 0,
    winnersRecognized: 0,
};
export function StatisticsContent() {
    const [stats, setStats] = useState(emptyStatistics);
    const [isEditing, setIsEditing] = useState(false);
    const [editValues, setEditValues] = useState(emptyStatistics);
    const { data: statisticsResponse } = useGetAdminStatisticsQuery();
    const [updateStatistics] = useUpdateAdminStatisticsMutation();
    useEffect(() => {
        if (statisticsResponse?.data) {
            setStats(statisticsResponse.data);
            setEditValues(statisticsResponse.data);
        }
    }, [statisticsResponse]);
    const handleEdit = () => {
        setEditValues(stats);
        setIsEditing(true);
    };
    const handleSave = async () => {
        await updateStatistics(editValues);
        setStats(editValues);
        setIsEditing(false);
        showSuccessAlert('Saved!', 'Statistics updated successfully');
    };
    const handleCancel = () => {
        setEditValues(stats);
        setIsEditing(false);
    };
    const handleValueChange = (key, value) => {
        setEditValues((prev) => ({
            ...prev,
            [key]: parseInt(value) || 0,
        }));
    };
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site Statistics</h1>
          <p className="text-muted-foreground">Manage the statistics displayed on the CPCCU website.</p>
        </div>
        {isEditing ? (<div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 size-4"/>
              Save Changes
            </Button>
          </div>) : (<Button onClick={handleEdit}>Edit Statistics</Button>)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statConfigs.map((config) => {
            const Icon = config.icon;
            const value = isEditing ? editValues[config.key] : stats[config.key];
            return (<Card key={config.key}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">{config.label}</span>
                    {isEditing ? (<Input type="number" value={value} onChange={(e) => handleValueChange(config.key, e.target.value)} className="mt-1 w-32"/>) : (<span className="text-3xl font-bold">{value.toLocaleString()}</span>)}
                  </div>
                  <div className={`rounded-lg p-2 ${config.bgColor}`}>
                    <Icon className={`size-5 ${config.color}`}/>
                  </div>
                </div>
              </CardContent>
            </Card>);
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statistics Overview</CardTitle>
          <CardDescription>
            These numbers are displayed across the CPCCU website to showcase the {"community's"} achievements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-3 font-semibold">Homepage Stats</h3>
              <p className="text-sm text-muted-foreground">
                The Members, Photos, Events, and Awards counts are displayed in the homepage stats section.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Members: {stats.members}</div>
                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Photos: {stats.photos}</div>
                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Events: {stats.events}</div>
                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Awards: {stats.awards}</div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-3 font-semibold">Certificate Page Stats</h3>
              <p className="text-sm text-muted-foreground">
                The certificate page shows certificates issued, contests held, and winners recognized.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Certificates: {stats.certificatesIssued}</div>
                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Contests: {stats.contestsHeld}</div>
                <div className="rounded bg-background px-2 py-1 text-xs font-medium">Winners: {stats.winnersRecognized}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Update</CardTitle>
          <CardDescription>Make bulk updates to all statistics at once.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statConfigs.map((config) => (<div key={config.key} className="flex flex-col gap-2">
                <Label htmlFor={config.key}>{config.label}</Label>
                <Input id={config.key} type="number" value={isEditing ? editValues[config.key] : stats[config.key]} onChange={(e) => handleValueChange(config.key, e.target.value)} disabled={!isEditing}/>
              </div>))}
          </div>
        </CardContent>
      </Card>
    </div>);
}
