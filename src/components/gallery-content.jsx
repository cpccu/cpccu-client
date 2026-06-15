'use client';
import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Image as ImageIcon, Folder } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import useAdminContent from '@/hooks/use-admin-content';
import { AdminImageUploadField } from '@/components/admin-image-upload-field';

export function GalleryContent() {
  const { items: galleryItems, createItem, updateItem, deleteItem, isLoading } = useAdminContent('gallery', []);
  const { items: eventList, createItem: createEvent, updateItem: updateEvent, deleteItem: deleteEvent } = useAdminContent('gallery-events', []);
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [editingEventItem, setEditingEventItem] = useState(null);
  const [photoFormData, setPhotoFormData] = useState({
    title: '',
    imageUrl: '',
    category: 'events',
    eventId: null,
    description: '',
  });
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    eventDate: '',
    featured: false,
  });

  const allCategories = ['all', 'events', 'recent', 'old', 'picnic', 'workshop', 'other'];

  const filteredItems = galleryItems.filter((item) => {
    const matchesSearch = 
      (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const itemEventId = typeof item.eventId === 'object' ? item.eventId._id || item.eventId.id : item.eventId;
    const matchesEvent = eventFilter === 'all' || 
      (eventFilter === 'none' && !itemEventId) ||
      itemEventId === eventFilter;
    return matchesSearch && matchesCategory && matchesEvent;
  });

  const openCreatePhoto = () => {
    setEditingPhoto(null);
    setPhotoFormData({ title: '', imageUrl: '', category: 'events', eventId: null, description: '' });
    setPhotoDialogOpen(true);
  };

  const openEditPhoto = (item) => {
    setEditingPhoto(item);
    setPhotoFormData({
      title: item.title || '',
      imageUrl: item.imageUrl || '',
      category: item.category || 'events',
      eventId: typeof item.eventId === 'object' ? item.eventId._id || item.eventId.id : item.eventId,
      description: item.description || '',
    });
    setPhotoDialogOpen(true);
  };

  const handleSavePhoto = async () => {
    if (editingPhoto) {
      await updateItem(editingPhoto.id, photoFormData);
      showSuccessAlert('Photo Updated', `"${photoFormData.title}" has been updated.`);
    } else {
      await createItem({ ...photoFormData, uploadedBy: 'Admin' });
      showSuccessAlert('Photo Added', `"${photoFormData.title}" has been added to the gallery.`);
    }
    setPhotoDialogOpen(false);
  };

  const handleDeletePhoto = async (item) => {
    const result = await showDeleteConfirm(item.title || 'Photo');
    if (result.isConfirmed) {
      await deleteItem(item.id);
      showSuccessAlert('Deleted', `Photo has been deleted.`);
    }
  };

  const openCreateEvent = () => {
    setEditingEventItem(null);
    setEventFormData({ title: '', description: '', eventDate: '', featured: false });
    setEventDialogOpen(true);
  };

  const openEditEventItem = (event) => {
    setEditingEventItem(event);
    setEventFormData({
      title: event.title || '',
      description: event.description || '',
      eventDate: event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : '',
      featured: event.featured || false,
    });
    setEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (editingEventItem) {
      await updateEvent(editingEventItem.id, eventFormData);
      showSuccessAlert('Event Updated', `"${eventFormData.title}" has been updated.`);
    } else {
      await createEvent(eventFormData);
      showSuccessAlert('Event Created', `"${eventFormData.title}" has been created.`);
    }
    setEventDialogOpen(false);
  };

  const handleDeleteEventItem = async (event) => {
    const result = await showDeleteConfirm(event.title || 'Event');
    if (result.isConfirmed) {
      await deleteEvent(event.id);
      showSuccessAlert('Deleted', `Event has been deleted.`);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Gallery</h1>
          <p className="text-muted-foreground">Manage gallery events and photos.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateEvent} variant="outline" className="gap-2">
            <Folder className="size-4"/>
            Manage Events
          </Button>
          <Button onClick={openCreatePhoto} className="gap-2">
            <Plus className="size-4"/>
            Add Photo
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search photos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"/>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Category"/>
              </SelectTrigger>
              <SelectContent>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Event"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="none">Ungrouped Photos</SelectItem>
                {eventList.map(event => (
                  <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden md:table-cell">Event</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No photos found.</TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const eventName = typeof item.eventId === 'object' ? item.eventId.title : eventList.find(e => e.id === item.eventId)?.title;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="size-12 object-cover rounded"/>
                        ) : (
                          <div className="size-12 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="size-5 text-muted-foreground"/>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{item.description}</p>
                        )}
</TableCell>
                       <TableCell>
                         <Badge variant="outline" className="capitalize">{item.category || 'events'}</Badge>
                       </TableCell>
                       <TableCell className="hidden md:table-cell">
                         {item.eventId ? (
                           <span className="text-sm">{eventName || 'Event'}</span>
                         ) : (
                           <span className="text-sm text-muted-foreground">Ungrouped</span>
                         )}
                       </TableCell>
                       <TableCell className="hidden lg:table-cell text-muted-foreground">
                         {item.eventDate || new Date(item.uploadedAt || item.createdAt || Date.now()).toLocaleDateString()}
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
                            <DropdownMenuItem onClick={() => openEditPhoto(item)}>
                              <Pencil className="mr-2 size-4"/> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeletePhoto(item)} className="text-destructive">
                              <Trash2 className="mr-2 size-4"/> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingPhoto ? 'Edit Photo' : 'Add Photo'}</DialogTitle>
            <DialogDescription>{editingPhoto ? 'Update photo details below.' : 'Add a new photo to the gallery.'}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input value={photoFormData.title} onChange={(e) => setPhotoFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Photo title"/>
            </div>
            <AdminImageUploadField
              id="photo-image"
              label="Photo"
              folder="cpccu/gallery"
              value={photoFormData.imageUrl}
              onChange={(url) => setPhotoFormData(prev => ({ ...prev, imageUrl: url }))}
            />
            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea value={photoFormData.description} onChange={(e) => setPhotoFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Optional photo description" rows={2}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select value={photoFormData.category} onValueChange={(v) => setPhotoFormData(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="events">Events</SelectItem>
                    <SelectItem value="recent">Recent</SelectItem>
                    <SelectItem value="old">Old</SelectItem>
                    <SelectItem value="picnic">Picnic</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Event (Optional)</Label>
                <Select value={photoFormData.eventId || 'none'} onValueChange={(v) => setPhotoFormData(prev => ({ ...prev, eventId: v === 'none' ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Event</SelectItem>
                    {eventList.map(event => (
                      <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhotoDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePhoto} disabled={!photoFormData.title.trim() || !photoFormData.imageUrl.trim()}>
              {editingPhoto ? 'Save Changes' : 'Add Photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Manage Gallery Events</DialogTitle>
            <DialogDescription>Create and manage events to group your gallery photos.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="eventTitle">Event Title</Label>
              <Input id="eventTitle" value={eventFormData.title} onChange={(e) => setEventFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Annual Meetup 2024"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eventDescription">Description</Label>
              <Textarea id="eventDescription" value={eventFormData.description} onChange={(e) => setEventFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description of the event" rows={2}/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eventDate">Event Date</Label>
              <Input id="eventDate" type="date" value={eventFormData.eventDate} onChange={(e) => setEventFormData(prev => ({ ...prev, eventDate: e.target.value }))}/>
            </div>
            <div className="border-t pt-4 max-h-64 overflow-y-auto">
              <h3 className="text-sm font-semibold mb-2">Existing Events</h3>
              {eventList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events created yet.</p>
              ) : (
                <div className="space-y-2">
                  {eventList.map(event => (
                    <div key={event.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{event.eventDate ? new Date(event.eventDate).toLocaleDateString() : 'No date'}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditEventItem(event)}>
                          <Pencil className="size-3"/>
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteEventItem(event)}>
                          <Trash2 className="size-3"/>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Close</Button>
            <Button onClick={handleSaveEvent} disabled={!eventFormData.title.trim()}>
              {editingEventItem ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}