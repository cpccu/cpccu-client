'use client';

import { useMemo, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AdminImageUploadField } from '@/components/admin-image-upload-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AdminDataTable } from '@/components/admin-data-table';
import useAdminContent from '@/hooks/use-admin-content';
import { showDeleteConfirm, showSuccessAlert } from '@/lib/alerts';

const emptyForm = {
  name: '',
  position: '',
  batch: '',
  technology: '',
  email: '',
  phone: '',
  img: '',
  github: '',
  linkedin: '',
  facebook: '',
  youtube: '',
  jobText: '',
  order: 0,
};

const jobObjectToText = (job = {}) =>
  Object.entries(job)
    .map(([title, company]) => `${title}: ${company}`)
    .join('\n');

const jobTextToObject = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((acc, line) => {
      const [title, ...companyParts] = line.split(':');
      if (title?.trim()) acc[title.trim()] = companyParts.join(':').trim();
      return acc;
    }, {});

export function AlumniContent() {
  const { items: alumni, createItem, updateItem, deleteItem } = useAdminContent('alumni', []);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlumni, setEditingAlumni] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return alumni.filter((item) =>
      [item.name, item.position, item.batch, item.technology, item.email]
        .some((value) => (value || '').toLowerCase().includes(needle))
    );
  }, [alumni, search]);

  const openCreate = () => {
    setEditingAlumni(null);
    setFormData({ ...emptyForm, order: alumni.length });
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditingAlumni(item);
    setFormData({
      name: item.name || '',
      position: item.position || '',
      batch: item.batch || '',
      technology: item.technology || '',
      email: item.email || '',
      phone: item.phone || '',
      img: item.img || item.avatar || '',
      github: item.socials?.github || '',
      linkedin: item.socials?.linkedin || '',
      facebook: item.socials?.facebook || '',
      youtube: item.socials?.youtube || '',
      jobText: jobObjectToText(item.job),
      order: Number(item.order) || 0,
    });
    setDialogOpen(true);
  };

  const buildPayload = () => ({
    name: formData.name,
    position: formData.position,
    batch: formData.batch,
    technology: formData.technology,
    email: formData.email,
    phone: formData.phone,
    img: formData.img,
    avatar: formData.img,
    job: jobTextToObject(formData.jobText),
    socials: {
      github: formData.github,
      linkedin: formData.linkedin,
      facebook: formData.facebook,
      youtube: formData.youtube,
    },
    order: Number(formData.order) || 0,
  });

  const handleSave = async () => {
    if (editingAlumni) {
      await updateItem(editingAlumni.id, buildPayload());
      showSuccessAlert('Alumni Updated', `${formData.name} has been updated.`);
    } else {
      await createItem(buildPayload());
      showSuccessAlert('Alumni Added', `${formData.name} has been added.`);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (item) => {
    const result = await showDeleteConfirm(item.name);
    if (result.isConfirmed) {
      await deleteItem(item.id);
      showSuccessAlert('Deleted', `${item.name} has been deleted.`);
    }
  };

  const columns = [
    { key: 'order', header: 'Order', accessor: 'order' },
    { key: 'name', header: 'Name', accessor: 'name', cellClassName: 'font-medium' },
    { key: 'position', header: 'Position', accessor: 'position' },
    { key: 'batch', header: 'Batch', accessor: 'batch' },
    { key: 'technology', header: 'Technology', accessor: 'technology' },
    { key: 'email', header: 'Email', accessor: 'email' },
    {
      key: 'actions',
      header: '',
      export: false,
      cell: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(item)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive">
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alumni</h1>
          <p className="text-muted-foreground">Manage alumni profiles shown on the public alumni page.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Add Alumni
        </Button>
      </div>

      <AdminDataTable
        columns={columns}
        rows={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search alumni..."
        exportFileName="alumni.csv"
        emptyText="No alumni found."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingAlumni ? 'Edit Alumni' : 'Add Alumni'}</DialogTitle>
            <DialogDescription>Update alumni details, job history, links, and display order.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Position</Label>
              <Input value={formData.position} onChange={(event) => setFormData((prev) => ({ ...prev, position: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Batch</Label>
              <Input value={formData.batch} onChange={(event) => setFormData((prev) => ({ ...prev, batch: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Technology</Label>
              <Input value={formData.technology} onChange={(event) => setFormData((prev) => ({ ...prev, technology: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Email</Label>
              <Input value={formData.email} onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Display Order</Label>
              <Input type="number" value={formData.order} onChange={(event) => setFormData((prev) => ({ ...prev, order: parseInt(event.target.value) || 0 }))} />
            </div>
            <div className="md:col-span-2">
              <AdminImageUploadField
                id="alumni-image"
                label="Alumni Photo"
                folder="cpccu/alumni"
                value={formData.img}
                onChange={(value) => setFormData((prev) => ({ ...prev, img: value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>GitHub</Label>
              <Input value={formData.github} onChange={(event) => setFormData((prev) => ({ ...prev, github: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>LinkedIn</Label>
              <Input value={formData.linkedin} onChange={(event) => setFormData((prev) => ({ ...prev, linkedin: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Facebook</Label>
              <Input value={formData.facebook} onChange={(event) => setFormData((prev) => ({ ...prev, facebook: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>YouTube</Label>
              <Input value={formData.youtube} onChange={(event) => setFormData((prev) => ({ ...prev, youtube: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Job History</Label>
              <Textarea
                value={formData.jobText}
                onChange={(event) => setFormData((prev) => ({ ...prev, jobText: event.target.value }))}
                rows={5}
                placeholder={'Software Engineer: Company Name\nFounder: Startup Name'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
