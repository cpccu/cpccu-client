'use client';
import { useState, useMemo, useEffect } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Mail, Shield, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AdminDataTable } from '@/components/admin-data-table';
import { demoMembers } from '@/lib/demo-data';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import { useCreateAdminMemberMutation, useDeleteAdminMemberMutation, useGetAdminMembersQuery, useUpdateAdminMemberMutation } from '@/features/admin/adminApi';
const statusStyles = {
    active: 'bg-success/15 text-success border-success/30',
    inactive: 'bg-muted text-muted-foreground border-border',
    pending: 'bg-warning/15 text-warning-foreground border-warning/30',
};
const roleStyles = {
    admin: 'bg-primary/15 text-primary border-primary/30',
    moderator: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
    member: 'bg-secondary text-secondary-foreground border-border',
};
export function MembersContent() {
    const [members, setMembers] = useState(demoMembers);
    const { data: membersResponse } = useGetAdminMembersQuery();
    const [createAdminMember] = useCreateAdminMemberMutation();
    const [deleteAdminMember] = useDeleteAdminMemberMutation();
    const [updateAdminMember] = useUpdateAdminMemberMutation();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'member',
        status: 'active',
        department: '',
        phone: '',
        skills: '',
        batch: '',
        uniID: '',
        password: '',
    });
    useEffect(() => {
        if (membersResponse?.data) {
            setMembers(membersResponse.data.map((member) => ({
                id: member._id,
                name: member.fullName,
                email: member.email,
                avatar: member.avatar || '',
                role: member.roles?.role || 'member',
                status: member.isValid ? 'active' : 'pending',
                department: member.section || '',
                joinedAt: member.createdAt || new Date().toISOString(),
                phone: member.phone || '',
                skills: member.skills || [],
                batch: member.batch || '',
                uniID: member.uniID || '',
            })));
        }
    }, [membersResponse]);
    const filtered = useMemo(() => {
        return members.filter((m) => {
            const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
                m.email.toLowerCase().includes(search.toLowerCase()) ||
                m.department.toLowerCase().includes(search.toLowerCase());
            const matchesRole = roleFilter === 'all' || m.role === roleFilter;
            const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [members, search, roleFilter, statusFilter]);
    const openCreate = () => {
        setEditingMember(null);
        setFormData({ name: '', email: '', role: 'member', status: 'active', department: '', phone: '', skills: '', batch: '', uniID: '', password: '' });
        setDialogOpen(true);
    };
    const openEdit = (member) => {
        setEditingMember(member);
        setFormData({
            name: member.name,
            email: member.email,
            role: member.role,
            status: member.status,
            department: member.department,
            phone: member.phone,
            skills: member.skills.join(', '),
            batch: member.batch || '',
            uniID: member.uniID || '',
            password: '',
        });
        setDialogOpen(true);
    };
    const handleSave = async () => {
        if (editingMember) {
            const updatedMember = {
                ...editingMember,
                ...formData,
                skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
            };
            await updateAdminMember({
                id: editingMember.id,
                fullName: formData.name,
                email: formData.email,
                phone: formData.phone,
                section: formData.department,
                skills: updatedMember.skills,
                role: formData.role,
                isValid: formData.status === 'active',
            });
            showSuccessAlert('Member Updated', `${formData.name}'s profile has been updated.`);
        }
        else {
            await createAdminMember({
                fullName: formData.name,
                email: formData.email,
                phone: formData.phone,
                section: formData.department,
                skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
                batch: formData.batch,
                uniID: formData.uniID,
                password: formData.password,
                role: formData.role,
                isValid: formData.status === 'active',
            });
            showSuccessAlert('Member Added', `${formData.name} has been added to the club.`);
        }
        setDialogOpen(false);
    };
    const handleDelete = async (member) => {
        const result = await showDeleteConfirm(member.name);
        if (result.isConfirmed) {
            await deleteAdminMember(member.id);
            showSuccessAlert('Removed', `${member.name} has been removed.`);
        }
    };
    const handleApprove = async (member) => {
        await updateAdminMember({ id: member.id, isValid: true });
        showSuccessAlert('Approved', `${member.name}'s membership has been approved.`);
    };
    const getInitials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase();
    const columns = [
        {
            key: 'member',
            header: 'Member',
            accessor: (member) => `${member.name} ${member.email}`,
            cell: (member) => (<div className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(member.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>),
        },
        {
            key: 'department',
            header: 'Department',
            accessor: 'department',
            cellClassName: 'hidden md:table-cell text-muted-foreground',
            className: 'hidden md:table-cell',
        },
        {
            key: 'role',
            header: 'Role',
            accessor: 'role',
            cell: (member) => <Badge variant="outline" className={`capitalize ${roleStyles[member.role] || ''}`}>{member.role}</Badge>,
        },
        {
            key: 'status',
            header: 'Status',
            accessor: 'status',
            cell: (member) => <Badge variant="outline" className={`capitalize ${statusStyles[member.status] || ''}`}>{member.status}</Badge>,
        },
        {
            key: 'joinedAt',
            header: 'Joined',
            accessor: (member) => formatDate(member.joinedAt),
            cellClassName: 'hidden lg:table-cell text-muted-foreground',
            className: 'hidden lg:table-cell',
        },
        {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            export: false,
            className: 'w-[50px]',
            cell: (member) => (<DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4"/>
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(member)}>
                  <Pencil className="mr-2 size-4"/> Edit
                </DropdownMenuItem>
                {member.status === 'pending' && (<DropdownMenuItem onClick={() => handleApprove(member)}>
                    <UserCheck className="mr-2 size-4"/> Approve
                  </DropdownMenuItem>)}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDelete(member)} className="text-destructive">
                  <Trash2 className="mr-2 size-4"/> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>),
        },
    ];
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Members</h1>
          <p className="text-muted-foreground">Manage club members, roles, and registrations.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4"/>
          Add Member
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
            { label: 'Total Members', value: members.length, icon: Shield },
            { label: 'Active', value: members.filter(m => m.status === 'active').length, icon: UserCheck },
            { label: 'Pending', value: members.filter(m => m.status === 'pending').length, icon: Mail },
            { label: 'Inactive', value: members.filter(m => m.status === 'inactive').length, icon: UserX },
        ].map(stat => (<Card key={stat.label}>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="size-4 text-primary"/>
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>))}
      </div>

      <AdminDataTable
        columns={columns}
        rows={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search members..."
        exportFileName="cpccu-members.csv"
        emptyText="No members found."
        toolbar={<>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Role"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </>}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Member' : 'Add New Member'}</DialogTitle>
            <DialogDescription>{editingMember ? 'Update member details.' : 'Add a new member to the club.'}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Full name"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="email@cpccu.club"/>
              </div>
            </div>
            {!editingMember && (<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch">Batch</Label>
                <Input id="batch" value={formData.batch} onChange={(e) => setFormData(prev => ({ ...prev, batch: e.target.value }))} placeholder="67"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="uniID">University ID</Label>
                <Input id="uniID" value={formData.uniID} onChange={(e) => setFormData(prev => ({ ...prev, uniID: e.target.value }))} placeholder="Student ID"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Temporary Password</Label>
                <Input id="password" type="password" value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} placeholder="At least 6 chars"/>
              </div>
            </div>)}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData(prev => ({ ...prev, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="department">Department</Label>
                <Input id="department" value={formData.department} onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))} placeholder="Computer Science"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+91 98765 43210"/>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input id="skills" value={formData.skills} onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))} placeholder="Python, React, Machine Learning"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim() || !formData.email.trim() || (!editingMember && (!formData.batch.trim() || !formData.uniID.trim() || formData.password.length < 6))}>
              {editingMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
