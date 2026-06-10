'use client';

import {
  Activity,
  Award,
  Calendar,
  FileText,
  Mail,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useGetAdminOverviewQuery } from '@/features/admin/adminApi';
import { useSelector } from 'react-redux';

const PIE_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626'];

const activityIcons = {
  member_joined: <UserPlus className="size-4" />,
  message_received: <Mail className="size-4" />,
  profile_submitted: <UserCheck className="size-4" />,
};

export function DashboardContent() {
  const { data: overviewResponse } = useGetAdminOverviewQuery();
  const user = useSelector((state) => state.auth.user);
  const liveStats = overviewResponse?.data || {};

  const stats = [
    { label: 'Total Members', value: liveStats.totalMembers || 0, icon: Users, description: `${liveStats.pendingMembers || 0} pending approvals` },
    { label: 'Active Events', value: liveStats.activeEvents || 0, icon: Calendar, description: 'Upcoming or ongoing events' },
    { label: 'Total Posts', value: liveStats.totalPosts || 0, icon: FileText, description: 'Published and draft content' },
    { label: 'Developer Profiles', value: liveStats.approvedProfiles || 0, icon: UserCheck, description: `${liveStats.pendingProfiles || 0} profiles pending` },
  ];

  const memberBreakdownData = [
    { name: 'Verified', value: liveStats.verifiedMembers || 0 },
    { name: 'Pending', value: liveStats.pendingMembers || 0 },
    { name: 'Admins', value: liveStats.adminMembers || 0 },
  ];

  const contentOverviewData = [
    { name: 'Posts', value: liveStats.totalPosts || 0 },
    { name: 'Events', value: liveStats.activeEvents || 0 },
    { name: 'Certificates', value: liveStats.totalCertificates || 0 },
    { name: 'Profiles', value: liveStats.approvedProfiles || 0 },
  ];

  const operations = [
    { label: 'Pending Members', value: liveStats.pendingMembers || 0, icon: Users, tone: 'text-warning' },
    { label: 'Unread Messages', value: liveStats.unreadMessages || 0, icon: Mail, tone: 'text-primary' },
    { label: 'Certificates Issued', value: liveStats.totalCertificates || 0, icon: Award, tone: 'text-success' },
    { label: 'System Health', value: 'Stable', icon: ShieldCheck, tone: 'text-success' },
  ];

  const activityItems = [
    { id: 'pending-members', type: 'member_joined', message: `${liveStats.pendingMembers || 0} membership requests waiting for review`, timestamp: 'Live database' },
    { id: 'unread-messages', type: 'message_received', message: `${liveStats.unreadMessages || 0} unread contact messages`, timestamp: 'Live database' },
    { id: 'pending-profiles', type: 'profile_submitted', message: `${liveStats.pendingProfiles || 0} developer profiles pending approval`, timestamp: 'Live database' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.fullName || 'Administrator'}. Here is the CPCCU command center.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" />
            Live Operations
          </CardTitle>
          <CardDescription>Immediate signals from the live database.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {operations.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-xl font-semibold">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
              </div>
              <item.icon className={`size-5 ${item.tone}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Member Breakdown</CardTitle>
            <CardDescription>Verified, pending, and admin users from the database.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ value: { label: 'Members', color: '#2563eb' } }} className="h-[280px]">
              <AreaChart data={memberBreakdownData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#fillMembers)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Content Overview</CardTitle>
            <CardDescription>Live totals across core admin modules.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ value: { label: 'Total', color: '#16a34a' } }} className="h-[280px]">
              <BarChart data={contentOverviewData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Signals</CardTitle>
            <CardDescription>Live operational items that may need attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {activityItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{activityIcons[item.type]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Member Status</CardTitle>
            <CardDescription>Live verification distribution.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ value: { label: 'Members', color: '#2563eb' } }} className="h-[200px]">
              <PieChart>
                <Pie data={memberBreakdownData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {memberBreakdownData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {memberBreakdownData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }} />
                  <span className="text-xs text-muted-foreground">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
