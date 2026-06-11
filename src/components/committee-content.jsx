'use client';

import { useMemo, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showDeleteConfirm, showSuccessAlert } from '@/lib/alerts';
import useAdminContent from '@/hooks/use-admin-content';
import { AdminImageUploadField } from '@/components/admin-image-upload-field';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  position: '',
  avatar: '',
  term: 'Running Committee',
  group: 'running',
  order: 0,
};

export function CommitteeContent() {
  const { items: committeeMembers, createItem, updateItem, deleteItem } = useAdminContent('committees', []);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const filtered = useMemo(() => {
    return committeeMembers.filter((member) => {
      const text = `${member.name || member.fullName || ''} ${member.email || ''} ${member.position || ''} ${member.term || ''}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesGroup = groupFilter === 'all' || member.group === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [committeeMembers, groupFilter, search]);

  const openCreate = () => {
    setEditingMember(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setFormData({
      name: member.name || member.fullName || '',
      email: member.email || '',
      phone: member.phone || '',
      position: member.position || '',
      avatar: member.avatar || member.img || '',
      term: member.term || 'Running Committee',
      group: member.group || 'running',
      order: member.order || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      ...formData,
      fullName: formData.name,
      img: formData.avatar,
      order: Number(formData.order) || 0,
    };

    if (editingMember) {
      await updateItem(editingMember.id, payload);
      showSuccessAlert('Committee Updated', `${formData.name} has been updated.`);
    } else {
      await createItem(payload);
      showSuccessAlert('Committee Added', `${formData.name} has been added.`);
    }

    setDialogOpen(false);
  };

  const handleDelete = async (member) => {
    const result = await showDeleteConfirm(member.name || member.fullName);
    if (result.isConfirmed) {
      await deleteItem(member.id);
      showSuccessAlert('Removed', 'Committee member removed.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Committees</h1>
          <p className="text-muted-foreground">Manage running and previous CPCCU committees.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Add Committee Member
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total', value: committeeMembers.length },
          { label: 'Running', value: committeeMembers.filter((member) => member.group === 'running').length },
          { label: 'Previous', value: committeeMembers.filter((member) => member.group === 'previous').length },
          { label: 'Terms', value: new Set(committeeMembers.map((member) => member.term).filter(Boolean)).size },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Users className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search committees..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
            </div>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Committee type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Committees</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="previous">Previous</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No committee members found.</TableCell>
                  </TableRow>
                ) : filtered.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={member.avatar || member.img} alt={member.name || member.fullName} />
                          <AvatarFallback>{(member.name || member.fullName || 'C')[0]}</AvatarFallback>
                        </Avatar>
                        <p className="font-medium">{member.name || member.fullName}</p>
                      </div>
                    </TableCell>
                    <TableCell>{member.position}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{member.group}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{member.term}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{member.email || member.phone || '-'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(member)}>
                            <Pencil className="mr-2 size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(member)} className="text-destructive">
                            <Trash2 className="mr-2 size-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Committee Member' : 'Add Committee Member'}</DialogTitle>
            <DialogDescription>Committee data powers the running and previous committee pages.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Position</Label>
              <Input value={formData.position} onChange={(event) => setFormData((prev) => ({ ...prev, position: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Email</Label>
              <Input value={formData.email} onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <AdminImageUploadField
                id="committee-avatar"
                label="Committee Photo"
                folder="cpccu/committees"
                value={formData.avatar}
                onChange={(value) => setFormData((prev) => ({ ...prev, avatar: value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Committee Type</Label>
              <Select value={formData.group} onValueChange={(value) => setFormData((prev) => ({ ...prev, group: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="previous">Previous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Term</Label>
              <Input value={formData.term} onChange={(event) => setFormData((prev) => ({ ...prev, term: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Sort Order</Label>
              <Input type="number" value={formData.order} onChange={(event) => setFormData((prev) => ({ ...prev, order: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim() || !formData.position.trim()}>
              {editingMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
