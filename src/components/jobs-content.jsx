'use client';
import { useState, useMemo } from 'react';
import { Search, MoreHorizontal, CheckCircle2, XCircle, Eye, Mail, Phone, Clock, UserCheck, UserX, Users, ChevronRight, ExternalLink, Globe } from 'lucide-react';
import { FaGithub as Github, FaLinkedin as Linkedin } from 'react-icons/fa';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { demoProfiles } from '@/lib/demo-data';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import useAdminContent from '@/hooks/use-admin-content';
const statusStyles = {
    pending: 'bg-warning/15 text-warning-foreground border-warning/30',
    approved: 'bg-success/15 text-success border-success/30',
    rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};
const statusIcons = {
    pending: <Clock className="size-3.5"/>,
    approved: <CheckCircle2 className="size-3.5"/>,
    rejected: <XCircle className="size-3.5"/>,
};
export function JobsContent() {
    const { items: profiles, updateItem, deleteItem } = useAdminContent('profiles', demoProfiles);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('all');
    const [detailProfile, setDetailProfile] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const filtered = useMemo(() => {
        return profiles.filter((p) => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.title.toLowerCase().includes(search.toLowerCase()) ||
                p.skills.some(s => s.name.toLowerCase().includes(search.toLowerCase())) ||
                p.department.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            const matchesTab = activeTab === 'all' || p.status === activeTab;
            return matchesSearch && matchesStatus && matchesTab;
        });
    }, [profiles, search, statusFilter, activeTab]);
    const stats = useMemo(() => ({
        total: profiles.length,
        approved: profiles.filter(p => p.status === 'approved').length,
        pending: profiles.filter(p => p.status === 'pending').length,
        rejected: profiles.filter(p => p.status === 'rejected').length,
    }), [profiles]);
    const handleApprove = async (profile) => {
        await updateItem(profile.id, { status: 'approved' });
        showSuccessAlert('Profile Approved', `${profile.name}'s developer profile is now visible to recruiters.`);
    };
    const handleReject = async (profile) => {
        const result = await showDeleteConfirm(`${profile.name}'s profile`);
        if (result.isConfirmed) {
            await updateItem(profile.id, { status: 'rejected' });
            showSuccessAlert('Profile Rejected', `${profile.name}'s profile has been rejected.`);
        }
    };
    const handleRevert = async (profile) => {
        await updateItem(profile.id, { status: 'pending' });
        showSuccessAlert('Reverted', `${profile.name}'s profile has been moved back to pending.`);
    };
    const handleRemove = async (profile) => {
        const result = await showDeleteConfirm(`${profile.name}'s profile`);
        if (result.isConfirmed) {
            await deleteItem(profile.id);
            showSuccessAlert('Removed', `${profile.name}'s profile has been removed.`);
        }
    };
    const openDetail = (profile) => {
        setDetailProfile(profile);
        setDetailOpen(true);
    };
    return (<div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">Developer Profiles</h1>
        <p className="text-muted-foreground">Review and manage student developer profiles visible to recruiters.</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
            { label: 'Total Profiles', value: stats.total, icon: Users, color: 'bg-primary/10 text-primary' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'bg-success/10 text-success' },
            { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'bg-warning/10 text-warning-foreground' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-destructive/10 text-destructive' },
        ].map(stat => (<Card key={stat.label}>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className={`flex size-9 items-center justify-center rounded-lg ${stat.color}`}>
                <stat.icon className="size-4"/>
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search by name, title, skill, or department..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"/>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({stats.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filtered.length === 0 ? (<Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">No developer profiles found.</p>
              </CardContent>
            </Card>) : (<div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((profile) => (<ProfileCard key={profile.id} profile={profile} onApprove={handleApprove} onReject={handleReject} onRevert={handleRevert} onRemove={handleRemove} onViewDetail={openDetail}/>))}
            </div>)}
        </TabsContent>
      </Tabs>

      {/* Profile Detail Dialog */}
      {detailProfile && (<Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Developer Profile</DialogTitle>
              <DialogDescription>Full profile details for {detailProfile.name}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-6 py-2">
              {/* Profile Header */}
              <div className="flex gap-5">
                <div className="size-28 shrink-0 overflow-hidden rounded-xl border-2 border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={detailProfile.photoUrl} alt={detailProfile.name} className="size-full object-cover"/>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{detailProfile.name}</h3>
                    <Badge variant="outline" className={`capitalize gap-1 ${statusStyles[detailProfile.status]}`}>
                      {statusIcons[detailProfile.status]}
                      {detailProfile.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-primary">{detailProfile.title}</p>
                  <p className="text-sm text-muted-foreground">{detailProfile.department}</p>
                  <p className="text-xs text-muted-foreground">Member since {formatDate(detailProfile.memberSince, 'dd MMMM, yyyy')}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-sm font-semibold">Contact Information</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-4 shrink-0"/>
                    <span>{detailProfile.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-4 shrink-0"/>
                    <span className="truncate">{detailProfile.email}</span>
                  </div>
                  <a href={detailProfile.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                    <Github className="size-4 shrink-0"/>
                    <span className="truncate">{detailProfile.githubUrl.replace('https://', '')}</span>
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground"/>
                  </a>
                  <a href={detailProfile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                    <Linkedin className="size-4 shrink-0"/>
                    <span className="truncate">{detailProfile.linkedinUrl.replace('https://', '')}</span>
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground"/>
                  </a>
                  {detailProfile.portfolioUrl && (<a href={detailProfile.portfolioUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                      <Globe className="size-4 shrink-0"/>
                      <span className="truncate">{detailProfile.portfolioUrl.replace('https://', '')}</span>
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground"/>
                    </a>)}
                </div>
              </div>

              {/* Skills */}
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold">Skills</h4>
                <div className="flex flex-col gap-2.5">
                  {detailProfile.skills.map((skill) => (<div key={skill.name} className="flex items-start gap-2">
                      <ChevronRight className="size-4 shrink-0 mt-0.5 text-primary"/>
                      <div>
                        <span className="text-sm font-medium">{skill.name}:</span>
                        <span className="text-sm text-muted-foreground ml-1">{skill.description}</span>
                      </div>
                    </div>))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t pt-4">
                {detailProfile.status === 'pending' && (<>
                    <Button onClick={() => { handleApprove(detailProfile); setDetailOpen(false); }} className="gap-2">
                      <CheckCircle2 className="size-4"/>
                      Approve Profile
                    </Button>
                    <Button variant="destructive" onClick={() => { handleReject(detailProfile); setDetailOpen(false); }} className="gap-2">
                      <XCircle className="size-4"/>
                      Reject
                    </Button>
                  </>)}
                {detailProfile.status === 'approved' && (<Button variant="outline" onClick={() => { handleRevert(detailProfile); setDetailOpen(false); }} className="gap-2">
                    <Clock className="size-4"/>
                    Revert to Pending
                  </Button>)}
                {detailProfile.status === 'rejected' && (<>
                    <Button onClick={() => { handleApprove(detailProfile); setDetailOpen(false); }} className="gap-2">
                      <CheckCircle2 className="size-4"/>
                      Approve Instead
                    </Button>
                    <Button variant="outline" onClick={() => { handleRevert(detailProfile); setDetailOpen(false); }} className="gap-2">
                      <Clock className="size-4"/>
                      Revert to Pending
                    </Button>
                  </>)}
              </div>
            </div>
          </DialogContent>
        </Dialog>)}
    </div>);
}
function ProfileCard({ profile, onApprove, onReject, onRevert, onRemove, onViewDetail }) {
    return (<Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* Top: Photo + Info */}
      <div className="flex gap-4 p-5">
        <button onClick={() => onViewDetail(profile)} className="size-24 shrink-0 overflow-hidden rounded-xl border-2 border-border cursor-pointer hover:border-primary/50 transition-colors" aria-label={`View ${profile.name}'s profile`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.photoUrl} alt={profile.name} className="size-full object-cover"/>
        </button>
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold truncate">{profile.name}</h3>
              <p className="text-sm text-primary font-medium">{profile.title}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 shrink-0">
                  <MoreHorizontal className="size-4"/>
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetail(profile)}>
                  <Eye className="mr-2 size-4"/> View Full Profile
                </DropdownMenuItem>
                {profile.status === 'pending' && (<>
                    <DropdownMenuItem onClick={() => onApprove(profile)}>
                      <CheckCircle2 className="mr-2 size-4"/> Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReject(profile)} className="text-destructive">
                      <XCircle className="mr-2 size-4"/> Reject
                    </DropdownMenuItem>
                  </>)}
                {profile.status === 'approved' && (<DropdownMenuItem onClick={() => onRevert(profile)}>
                    <Clock className="mr-2 size-4"/> Revert to Pending
                  </DropdownMenuItem>)}
                {profile.status === 'rejected' && (<>
                    <DropdownMenuItem onClick={() => onApprove(profile)}>
                      <CheckCircle2 className="mr-2 size-4"/> Approve Instead
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRevert(profile)}>
                      <Clock className="mr-2 size-4"/> Revert to Pending
                    </DropdownMenuItem>
                  </>)}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRemove(profile)} className="text-destructive">
                  <XCircle className="mr-2 size-4"/> Remove Profile
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Mail className="size-3 shrink-0"/>
              <span className="truncate">{profile.email}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 shrink-0"/>
              <span>{profile.phone}</span>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer" aria-label="GitHub profile" className="text-foreground hover:text-primary transition-colors">
              <Github className="size-4"/>
            </a>
            <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile" className="text-foreground hover:text-primary transition-colors">
              <Linkedin className="size-4"/>
            </a>
            {profile.portfolioUrl && (<a href={profile.portfolioUrl} target="_blank" rel="noopener noreferrer" aria-label="Portfolio website" className="text-foreground hover:text-primary transition-colors">
                <Globe className="size-4"/>
              </a>)}
          </div>
        </div>
      </div>

      {/* Skills Row */}
      <div className="border-t bg-muted/30 px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (<Badge key={skill.name} variant="secondary" className="text-xs font-normal">
              {skill.name}
            </Badge>))}
        </div>
      </div>

      {/* Footer: Status + Since + Actions */}
      <div className="flex items-center justify-between border-t px-5 py-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`capitalize gap-1 text-xs ${statusStyles[profile.status]}`}>
            {statusIcons[profile.status]}
            {profile.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Since {formatDate(profile.memberSince, 'MMM yyyy')}
          </span>
        </div>
        {profile.status === 'pending' && (<div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-success hover:text-success hover:bg-success/10" onClick={() => onApprove(profile)}>
              <UserCheck className="size-3.5"/>
              <span className="hidden sm:inline">Approve</span>
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onReject(profile)}>
              <UserX className="size-3.5"/>
              <span className="hidden sm:inline">Reject</span>
            </Button>
          </div>)}
      </div>
    </Card>);
}
