'use client';
import { Users, Calendar, FileText, UserCheck, TrendingUp, TrendingDown, UserPlus, Mail, Award, Activity, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { dashboardStats, memberGrowthData, eventAttendanceData, postCategoryData, recentActivity, } from '@/lib/demo-data';
import { useGetAdminOverviewQuery } from '@/features/admin/adminApi';
import { useSelector } from 'react-redux';
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'];
const activityIcons = {
    member_joined: <UserPlus className="size-4"/>,
    post_published: <FileText className="size-4"/>,
    event_created: <Calendar className="size-4"/>,
    profile_submitted: <UserCheck className="size-4"/>,
    message_received: <Mail className="size-4"/>,
};
export function DashboardContent() {
    const { data: overviewResponse } = useGetAdminOverviewQuery();
    const user = useSelector((state) => state.auth.user);
    const liveStats = { ...dashboardStats, ...overviewResponse?.data };
    const stats = [
        {
            label: 'Total Members',
            value: liveStats.totalMembers,
            change: `+${dashboardStats.memberGrowth}%`,
            trend: 'up',
            icon: Users,
            description: 'vs last month',
        },
        {
            label: 'Active Events',
            value: liveStats.activeEvents,
            change: `${dashboardStats.eventAttendance}%`,
            trend: 'up',
            icon: Calendar,
            description: 'attendance rate',
        },
        {
            label: 'Total Posts',
            value: liveStats.totalPosts,
            change: `+${dashboardStats.postEngagement}%`,
            trend: 'up',
            icon: FileText,
            description: 'engagement rate',
        },
        {
            label: 'Developer Profiles',
            value: liveStats.approvedProfiles,
            change: `${liveStats.pendingProfiles} pending`,
            trend: 'up',
            icon: UserCheck,
            description: 'published profiles',
        },
    ];
    const operations = [
        {
            label: 'Pending Members',
            value: liveStats.pendingMembers || 0,
            icon: Users,
            tone: 'text-warning',
        },
        {
            label: 'Unread Messages',
            value: liveStats.unreadMessages || 0,
            icon: Mail,
            tone: 'text-primary',
        },
        {
            label: 'Certificates Issued',
            value: liveStats.totalCertificates || 0,
            icon: Award,
            tone: 'text-success',
        },
        {
            label: 'System Health',
            value: 'Stable',
            icon: ShieldCheck,
            tone: 'text-success',
        },
    ];
    return (<div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.fullName || 'Administrator'}. Here is the CPCCU command center.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (<Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="size-4 text-muted-foreground"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {stat.trend === 'up' ? (<TrendingUp className="size-3 text-success"/>) : (<TrendingDown className="size-3 text-destructive"/>)}
                <span className={stat.trend === 'up' ? 'text-success' : 'text-destructive'}>{stat.change}</span>
                <span>{stat.description}</span>
              </div>
            </CardContent>
          </Card>))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4"/>
            Live Operations
          </CardTitle>
          <CardDescription>Immediate signals for member governance, communication, certificates, and platform status.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {operations.map((item) => (<div key={item.label} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-xl font-semibold">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
              </div>
              <item.icon className={`size-5 ${item.tone}`}/>
            </div>))}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {/* Member Growth Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Member Growth</CardTitle>
            <CardDescription>Total members and new registrations over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
            value: { label: 'Total Members', color: '#6366f1' },
            secondary: { label: 'New Members', color: '#22c55e' },
        }} className="h-[280px]">
              <AreaChart data={memberGrowthData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="fillSecondary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border"/>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground"/>
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground"/>
                  <ChartTooltip content={<ChartTooltipContent />}/>
                  <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#fillValue)" strokeWidth={2}/>
                  <Area type="monotone" dataKey="secondary" stroke="#22c55e" fill="url(#fillSecondary)" strokeWidth={2}/>
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Event Attendance Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Event Attendance</CardTitle>
            <CardDescription>Average attendance by event type (%)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
            value: { label: 'Attendance', color: '#6366f1' },
        }} className="h-[280px]">
              <BarChart data={eventAttendanceData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border"/>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground"/>
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground"/>
                  <ChartTooltip content={<ChartTooltipContent />}/>
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}/>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {recentActivity.map((item) => (<div key={item.id} className="flex items-start gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {activityIcons[item.type]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                  </div>
                </div>))}
            </div>
          </CardContent>
        </Card>

        {/* Posts by Category */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Posts by Category</CardTitle>
            <CardDescription>Distribution of posts across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
            value: { label: 'Posts', color: '#6366f1' },
        }} className="h-[200px]">
              <PieChart>
                  <Pie data={postCategoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {postCategoryData.map((_, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]}/>))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />}/>
              </PieChart>
            </ChartContainer>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {postCategoryData.map((item, index) => (<div key={item.name} className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }}/>
                  <span className="text-xs text-muted-foreground">{item.name} ({item.value})</span>
                </div>))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);
}
