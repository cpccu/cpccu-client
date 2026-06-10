'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Star, StarOff, Grid, List } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import useAdminContent from '@/hooks/use-admin-content';
import { AdminImageUploadField } from '@/components/admin-image-upload-field';
export function GalleryContent() {
    const { items, createItem, updateItem, deleteItem } = useAdminContent('gallery', []);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [viewMode, setViewMode] = useState('grid');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        imageUrl: '',
        category: 'events',
        featured: false,
    });
    const filtered = useMemo(() => {
        return items.filter((item) => {
            const matchesSearch = (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.description || '').toLowerCase().includes(search.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [items, search, categoryFilter]);
    const openCreate = () => {
        setEditingItem(null);
        setFormData({ title: '', description: '', imageUrl: '', category: 'events', featured: false });
        setDialogOpen(true);
    };
    const openEdit = (item) => {
        setEditingItem(item);
        setFormData({
            title: item.title,
            description: item.description,
            imageUrl: item.imageUrl,
            category: item.category,
            featured: item.featured,
        });
        setDialogOpen(true);
    };
    const handleSave = async () => {
        if (editingItem) {
            await updateItem(editingItem.id, { ...editingItem, ...formData });
            showSuccessAlert('Updated', `"${formData.title}" has been updated.`);
        }
        else {
            const newItem = {
                title: formData.title,
                description: formData.description,
                imageUrl: formData.imageUrl || 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop',
                category: formData.category,
                uploadedBy: 'Ananya Sharma',
                uploadedAt: new Date().toISOString(),
                featured: formData.featured,
            };
            await createItem(newItem);
            showSuccessAlert('Uploaded', `"${formData.title}" has been added to the gallery.`);
        }
        setDialogOpen(false);
    };
    const handleDelete = async (item) => {
        const result = await showDeleteConfirm(item.title);
        if (result.isConfirmed) {
            await deleteItem(item.id);
            showSuccessAlert('Deleted', `"${item.title}" has been removed.`);
        }
    };
    const toggleFeatured = async (item) => {
        await updateItem(item.id, { featured: !item.featured });
        showSuccessAlert(item.featured ? 'Unfeatured' : 'Featured', `"${item.title}" has been ${item.featured ? 'removed from' : 'added to'} featured.`);
    };
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Gallery</h1>
          <p className="text-muted-foreground">Manage photos and media from club activities.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4"/>
          Upload Photo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
            { label: 'Total Media', value: items.length },
            { label: 'Featured', value: items.filter((item) => item.featured).length },
            { label: 'Event Photos', value: items.filter((item) => item.category === 'events').length },
            { label: 'Competition Photos', value: items.filter((item) => item.category === 'competitions').length },
        ].map((stat) => (<Card key={stat.label}>
            <CardContent className="pt-4">
              <p className="text-xl font-bold">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search gallery..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"/>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Category"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="workshops">Workshops</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="competitions">Competitions</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="size-8" onClick={() => setViewMode('grid')}>
                <Grid className="size-4"/>
                <span className="sr-only">Grid view</span>
              </Button>
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="size-8" onClick={() => setViewMode('list')}>
                <List className="size-4"/>
                <span className="sr-only">List view</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Content */}
      {filtered.length === 0 ? (<Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No gallery items found.</p>
          </CardContent>
        </Card>) : viewMode === 'grid' ? (<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (<Card key={item.id} className="overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.title} className="size-full object-cover transition-transform duration-300 hover:scale-105"/>
                {item.featured && (<div className="absolute top-2 left-2">
                    <Badge className="bg-warning text-warning-foreground border-0 gap-1">
                      <Star className="size-3 fill-current"/> Featured
                    </Badge>
                  </div>)}
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="size-8">
                        <MoreHorizontal className="size-4"/>
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(item)}>
                        <Pencil className="mr-2 size-4"/> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleFeatured(item)}>
                        {item.featured ? <StarOff className="mr-2 size-4"/> : <Star className="mr-2 size-4"/>}
                        {item.featured ? 'Unfeature' : 'Feature'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive">
                        <Trash2 className="mr-2 size-4"/> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                  </div>
                  <Badge variant="outline" className="capitalize shrink-0 text-xs">{item.category}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>By {item.uploadedBy}</span>
                  <span>{formatDate(item.uploadedAt)}</span>
                </div>
              </CardContent>
            </Card>))}
        </div>) : (<Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Uploaded By</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (<TableRow key={item.id}>
                    <TableCell>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.title} className="size-12 rounded-md object-cover"/>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="capitalize">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{item.uploadedBy}</TableCell>
                    <TableCell>
                      {item.featured ? (<Star className="size-4 text-warning fill-warning"/>) : (<span className="text-xs text-muted-foreground">-</span>)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatDate(item.uploadedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4"/>
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(item)}><Pencil className="mr-2 size-4"/> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleFeatured(item)}>
                            {item.featured ? <StarOff className="mr-2 size-4"/> : <Star className="mr-2 size-4"/>}
                            {item.featured ? 'Unfeature' : 'Feature'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive"><Trash2 className="mr-2 size-4"/> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>)}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Gallery Item' : 'Upload Photo'}</DialogTitle>
            <DialogDescription>{editingItem ? 'Update the gallery item details.' : 'Add a new photo to the gallery.'}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-title">Title</Label>
              <Input id="g-title" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Photo title"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-desc">Description</Label>
              <Textarea id="g-desc" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description..." rows={2}/>
            </div>
            <AdminImageUploadField
              id="g-url"
              label="Gallery Image"
              folder="cpccu/gallery"
              value={formData.imageUrl}
              onChange={(value) => setFormData(prev => ({ ...prev, imageUrl: value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="events">Events</SelectItem>
                    <SelectItem value="workshops">Workshops</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="competitions">Competitions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Featured</Label>
                <div className="flex h-9 items-center">
                  <Switch checked={formData.featured} onCheckedChange={(v) => setFormData(prev => ({ ...prev, featured: v }))}/>
                  <span className="ml-2 text-sm text-muted-foreground">{formData.featured ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.title.trim()}>
              {editingItem ? 'Save Changes' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
