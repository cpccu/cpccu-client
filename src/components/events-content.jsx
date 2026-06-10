'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, MapPin, Users, CalendarDays, Gift, ExternalLink, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import useAdminContent from '@/hooks/use-admin-content';
import { AdminImageUploadField } from '@/components/admin-image-upload-field';
const statusStyles = {
    upcoming: 'bg-primary/15 text-primary border-primary/30',
    ongoing: 'bg-success/15 text-success border-success/30',
    completed: 'bg-muted text-muted-foreground border-border',
    cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};
const typeLabels = {
    workshop: 'Workshop',
    seminar: 'Seminar',
    hackathon: 'Hackathon',
    meetup: 'Meetup',
    competition: 'Competition',
    bootcamp: 'Bootcamp',
    online_class: 'Online Class',
    contest: 'Contest',
};
export function EventsContent() {
    const { items: events, createItem, updateItem, deleteItem } = useAdminContent('events', []);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        date: '',
        endDate: '',
        location: '',
        type: 'workshop',
        status: 'upcoming',
        capacity: 50,
        reward: '',
        registrationLink: '',
        contestLink: '',
        meetLink: '',
        vjudgeGroupLink: '',
        image: '',
    });
    const filtered = useMemo(() => {
        return events.filter((e) => {
            const matchesSearch = (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
                (e.location || '').toLowerCase().includes(search.toLowerCase()) ||
                (e.organizer || '').toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
            const matchesType = typeFilter === 'all' || e.type === typeFilter;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [events, search, statusFilter, typeFilter]);
    const openCreate = () => {
        setEditingEvent(null);
        setFormData({
            title: '',
            description: '',
            date: '',
            endDate: '',
            location: '',
            type: 'workshop',
            status: 'upcoming',
            capacity: 50,
            reward: '',
            registrationLink: '',
            contestLink: '',
            meetLink: '',
            vjudgeGroupLink: '',
            image: '',
        });
        setDialogOpen(true);
    };
    const openEdit = (event) => {
        setEditingEvent(event);
        setFormData({
            title: event.title,
            description: event.description,
            date: event.date ? event.date.slice(0, 16) : '',
            endDate: event.endDate ? event.endDate.slice(0, 16) : '',
            location: event.location,
            type: event.type,
            status: event.status,
            capacity: event.capacity || 0,
            reward: event.reward || '',
            registrationLink: event.registrationLink || '',
            contestLink: event.contestLink || '',
            meetLink: event.meetLink || '',
            vjudgeGroupLink: event.vjudgeGroupLink || '',
            image: event.image || '',
        });
        setDialogOpen(true);
    };
    const handleSave = async () => {
        if (editingEvent) {
            const updatedEvent = {
                ...editingEvent,
                ...formData,
                date: new Date(formData.date || Date.now()).toISOString(),
                endDate: new Date(formData.endDate || formData.date || Date.now()).toISOString(),
                reward: formData.reward || undefined,
                registrationLink: formData.registrationLink || undefined,
                contestLink: formData.contestLink || undefined,
                meetLink: formData.meetLink || undefined,
                vjudgeGroupLink: formData.vjudgeGroupLink || undefined,
                image: formData.image || '',
            };
            await updateItem(editingEvent.id, updatedEvent);
            showSuccessAlert('Event Updated', `"${formData.title}" has been updated.`);
        }
        else {
            const newEvent = {
                title: formData.title,
                description: formData.description,
                date: new Date(formData.date || Date.now()).toISOString(),
                endDate: new Date(formData.endDate || formData.date || Date.now()).toISOString(),
                location: formData.location,
                type: formData.type,
                status: formData.status,
                capacity: formData.capacity,
                registered: 0,
                organizer: 'CPCCU',
                image: '',
                reward: formData.reward || undefined,
                registrationLink: formData.registrationLink || undefined,
                contestLink: formData.contestLink || undefined,
                meetLink: formData.meetLink || undefined,
                vjudgeGroupLink: formData.vjudgeGroupLink || undefined,
                image: formData.image || '',
            };
            await createItem(newEvent);
            showSuccessAlert('Event Created', `"${formData.title}" has been created.`);
        }
        setDialogOpen(false);
    };
    const handleDelete = async (event) => {
        const result = await showDeleteConfirm(event.title);
        if (result.isConfirmed) {
            await deleteItem(event.id);
            showSuccessAlert('Deleted', `"${event.title}" has been deleted.`);
        }
    };
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Events</h1>
          <p className="text-muted-foreground">Manage club events, contests, workshops, and bootcamps.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4"/>
          New Event
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
            { label: 'Upcoming', value: events.filter((event) => event.status === 'upcoming').length },
            { label: 'Ongoing', value: events.filter((event) => event.status === 'ongoing').length },
            { label: 'Completed', value: events.filter((event) => event.status === 'completed').length },
            { label: 'Total Capacity', value: events.reduce((sum, event) => sum + (Number(event.capacity) || 0), 0) },
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
              <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"/>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Type"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="seminar">Seminar</SelectItem>
                <SelectItem value="hackathon">Hackathon</SelectItem>
                <SelectItem value="meetup">Meetup</SelectItem>
                <SelectItem value="competition">Competition</SelectItem>
                <SelectItem value="bootcamp">Bootcamp</SelectItem>
                <SelectItem value="online_class">Online Class</SelectItem>
                <SelectItem value="contest">Contest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Event Cards Grid */}
      {filtered.length === 0 ? (<Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No events found.</p>
          </CardContent>
        </Card>) : (<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => {
                const fillPercent = event.capacity > 0 ? (event.registered / event.capacity) * 100 : 0;
                const hasLinks = event.registrationLink || event.contestLink || event.meetLink || event.vjudgeGroupLink;
                return (<Card key={event.id} className="flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className={`capitalize text-xs ${statusStyles[event.status] || ''}`}>
                        {event.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[event.type]}
                      </Badge>
                    </div>
                    <CardTitle className="text-base leading-snug">{event.title}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 shrink-0">
                        <MoreHorizontal className="size-4"/>
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(event)}>
                        <Pencil className="mr-2 size-4"/> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(event)} className="text-destructive">
                        <Trash2 className="mr-2 size-4"/> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-3.5 shrink-0"/>
                      <span>{formatDate(event.date, 'MMM dd, yyyy h:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0"/>
                      <span className="truncate">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 shrink-0"/>
                      <span>Organizer: {event.organizer}</span>
                    </div>
                    {event.reward && (<div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Gift className="size-3.5 shrink-0"/>
                        <span className="truncate">{event.reward}</span>
                      </div>)}
                  </div>
                  {hasLinks && (<div className="flex flex-wrap gap-1.5 pt-1">
                      {event.registrationLink && (<Button variant="outline" size="sm" className="h-6 px-2 text-xs" asChild>
                          <a href={event.registrationLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 size-3"/>
                            Register
                          </a>
                        </Button>)}
                      {event.contestLink && (<Button variant="outline" size="sm" className="h-6 px-2 text-xs" asChild>
                          <a href={event.contestLink} target="_blank" rel="noopener noreferrer">
                            <Link2 className="mr-1 size-3"/>
                            Contest
                          </a>
                        </Button>)}
                      {event.vjudgeGroupLink && (<Button variant="outline" size="sm" className="h-6 px-2 text-xs" asChild>
                          <a href={event.vjudgeGroupLink} target="_blank" rel="noopener noreferrer">
                            <Link2 className="mr-1 size-3"/>
                            Vjudge
                          </a>
                        </Button>)}
                    </div>)}
                  <div className="mt-auto pt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{event.registered} / {event.capacity} registered</span>
                      <span>{Math.round(fillPercent)}%</span>
                    </div>
                    <Progress value={fillPercent} className="h-1.5"/>
                  </div>
                </CardContent>
              </Card>);
            })}
        </div>)}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
            <DialogDescription>{editingEvent ? 'Update event details.' : 'Fill in the details for a new event.'}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="links">Links & Rewards</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-title">Title</Label>
                <Input id="event-title" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Event title"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-desc">Description</Label>
                <Textarea id="event-desc" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Event description..." rows={3}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-start">Start Date/Time</Label>
                  <Input id="event-start" type="datetime-local" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}/>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-end">End Date/Time</Label>
                  <Input id="event-end" type="datetime-local" value={formData.endDate} onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}/>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-loc">Location</Label>
                <Input id="event-loc" value={formData.location} onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))} placeholder="Main Auditorium, Block A or Online"/>
              </div>
              <AdminImageUploadField
                id="event-image"
                label="Event Image"
                folder="cpccu/events"
                value={formData.image}
                onChange={(value) => setFormData(prev => ({ ...prev, image: value }))}
              />
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="seminar">Seminar</SelectItem>
                      <SelectItem value="hackathon">Hackathon</SelectItem>
                      <SelectItem value="meetup">Meetup</SelectItem>
                      <SelectItem value="competition">Competition</SelectItem>
                      <SelectItem value="bootcamp">Bootcamp</SelectItem>
                      <SelectItem value="online_class">Online Class</SelectItem>
                      <SelectItem value="contest">Contest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-cap">Capacity</Label>
                  <Input id="event-cap" type="number" value={formData.capacity} onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}/>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="links" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-reward">Reward / Prize (Optional)</Label>
                <Input id="event-reward" value={formData.reward} onChange={(e) => setFormData(prev => ({ ...prev, reward: e.target.value }))} placeholder="e.g. Winners will get certificates and prizes"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-registration">Registration Link (Optional)</Label>
                <Input id="event-registration" value={formData.registrationLink} onChange={(e) => setFormData(prev => ({ ...prev, registrationLink: e.target.value }))} placeholder="https://forms.google.com/..."/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-contest">Contest Link (Optional)</Label>
                <Input id="event-contest" value={formData.contestLink} onChange={(e) => setFormData(prev => ({ ...prev, contestLink: e.target.value }))} placeholder="https://vjudge.net/contest/..."/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-vjudge">Vjudge Group Link (Optional)</Label>
                <Input id="event-vjudge" value={formData.vjudgeGroupLink} onChange={(e) => setFormData(prev => ({ ...prev, vjudgeGroupLink: e.target.value }))} placeholder="https://vjudge.net/group/..."/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-meet">Google Meet / Online Link (Optional)</Label>
                <Input id="event-meet" value={formData.meetLink} onChange={(e) => setFormData(prev => ({ ...prev, meetLink: e.target.value }))} placeholder="https://meet.google.com/..."/>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.title.trim()}>
              {editingEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
