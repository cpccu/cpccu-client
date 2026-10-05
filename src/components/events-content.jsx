'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, MapPin, CalendarDays, Gift, ExternalLink, Link2, ListOrdered, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import useAdminContent from '@/hooks/use-admin-content';
import { AdminImageUploadField } from '@/components/admin-image-upload-field';
import { ScheduleInstantField } from '@/components/event-schedule';
import { EVENT_SCHEDULE_FIELDS } from '@/lib/event-schedule';
import {
    EMPTY_PARTICIPATION_FORM,
    EventParticipationSettings,
    participationFromEvent,
    participationToPayload,
} from '@/components/admin-event-participation-settings';
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
        eventStartAt: '',
        eventEndAt: '',
        location: '',
        type: 'workshop',
        status: 'upcoming',
        eventHeadLine1: '',
        eventHeadLine2: 'Reward',
        eventHeadLine3: 'Rules',
        reward: '',
        rules1: '',
        rules2: '',
        rules3: '',
        rules4: '',
        btnText: '',
        btnLink: '',
        btnText1: '',
        btnLink1: '',
        order: 0,
        image: '',
        // ⚠️ THE PARTICIPATION FIELDS ARE IN `formData` AND IN THE PAYLOAD, NOT
        // ONLY IN THE EDITOR. The server applies an admin save as `$set:
        // req.body`, so any field absent from the payload is UNSET — with a 200
        // and no error anywhere. Leaving these out of `handleSave` would mean the
        // moment an admin ticked "in-app registration" and pressed Save, the
        // switch silently snapped back off and nobody could tell why.
        //
        // That now covers all TWELVE schedule fields, including the two event
        // instants this form edits itself: they are declared in
        // `EMPTY_PARTICIPATION_FORM` too, because a payload that omits one is
        // UNSET, and `$set` does not distinguish "not sent" from "set to null".
        ...EMPTY_PARTICIPATION_FORM,
    });
    // ⚠️ THIS FORM KEEPS THE BROWSER-TIMEZONE DATE ROUND TRIP, AND IT IS THE ONE
    // ADMIN SURFACE THAT DOES. `event.eventStartAt.slice(0, 16)` on the way in
    // and `new Date(value).toISOString()` on the way out interpret the typed
    // wall-clock in the ADMIN'S BROWSER timezone: correct for a Dhaka admin,
    // silently wrong — shifted by the browser's UTC offset — for one abroad. It is
    // a documented bug (`src/lib/dhaka-time.js`) and it is left as it is, because
    // the form covers the entire historical event archive and switching it to
    // Dhaka wall-clock would re-interpret the stored instant of every event that
    // already exists.
    //
    // So these two helpers are passed EXPLICITLY to `ScheduleInstantField` rather
    // than letting its Dhaka defaults apply. Nothing about that choice is visible
    // in a diff of this file, which is exactly why it is stated in both places:
    // inheriting Dhaka here would have quietly shifted every event by six hours
    // the first time someone reused the shared field, with no error anywhere.
    const toBrowserInputValue = (value) =>
        typeof value === 'string' ? value.slice(0, 16) : '';
    const fromBrowserInputValue = (value) =>
        value ? new Date(value).toISOString() : null;
    // ⚠️ THE HACKATHON IS NOT EDITED HERE. `/admin/events` and
    // `/admin/hackathon` are two editors for the SAME record with DIFFERENT
    // date rules, which is a trap rather than a convenience:
    //
    //   this form  — a UTC slice in, `new Date(value).toISOString()` out (see
    //                 above), i.e. the admin's browser timezone.
    //   that form  — `toDhakaInputValue` / `utcIsoFromDhakaInput`, i.e. Dhaka
    //                 wall-clock pinned to UTC+6 regardless of where the admin
    //                 is.
    //
    // The data survives an Events-form save (it spreads `...editingEvent`), so
    // this is a corruption-of-timing trap, not a data-loss one. The chosen
    // direction is: THIS PAGE STOPS EDITING HACKATHONS. `/admin/hackathon` is
    // the single editor, which is also the premise the master toggle rests on —
    // a toggle that lives on one page and whose dates are edited on another is
    // not a coherent control surface.
    const HACKATHON_PATH = '/admin/hackathon';

    // Counted over ALL events (including hackathons) so the stat tiles keep
    // reporting the real collection size; only the editable list is narrowed.
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
            eventStartAt: '',
            eventEndAt: '',
            location: '',
            type: 'workshop',
            status: 'upcoming',
            eventHeadLine1: '',
            eventHeadLine2: 'Reward',
            eventHeadLine3: 'Rules',
            reward: '',
            rules1: '',
            rules2: '',
            rules3: '',
            rules4: '',
            btnText: '',
            btnLink: '',
            btnText1: '',
            btnLink1: '',
            order: events.length,
            image: '',
            ...EMPTY_PARTICIPATION_FORM,
        });
        setDialogOpen(true);
    };
    const openEdit = (event) => {
        setEditingEvent(event);
        setFormData({
            title: event.title,
            description: event.description,
            // ⚠️ THE READ PATH IS THE UTC SLICE, ON PURPOSE — see the note on
        // `toBrowserInputValue`. A `Date` serialised by Mongoose arrives as
        // `2026-10-01T03:30:00.000Z`; `slice(0, 16)` is the wall-clock the browser
        // understood when the admin typed it, which is what re-saving must show.
        // Routing it through the Dhaka formatter instead would shift every existing
        // event by six hours the first time an admin opened and saved it.
        eventStartAt: event.eventStartAt ? toBrowserInputValue(event.eventStartAt) : '',
        eventEndAt: event.eventEndAt ? toBrowserInputValue(event.eventEndAt) : '',
            location: event.location,
            type: event.type,
            status: event.status,
            eventHeadLine1: event.eventHeadLine1 || event.title || '',
            eventHeadLine2: event.eventHeadLine2 || 'Reward',
            eventHeadLine3: event.eventHeadLine3 || 'Rules',
            reward: event.reward || '',
            rules1: event.rules1 || '',
            rules2: event.rules2 || '',
            rules3: event.rules3 || '',
            rules4: event.rules4 || '',
            btnText: event.btnText || event.registrationText || '',
            btnLink: event.btnLink || event.registrationLink || '',
            btnText1: event.btnText1 || event.contestText || '',
            btnLink1: event.btnLink1 || event.contestLink || '',
            order: Number(event.order) || 0,
            image: event.image || '',
            ...participationFromEvent(event),
        });
        setDialogOpen(true);
    };
    const handleSave = async () => {
        if (editingEvent) {
            const updatedEvent = {
                ...editingEvent,
                ...formData,
                eventHeadLine1: formData.eventHeadLine1 || formData.title,
                eventHeadLine2: formData.eventHeadLine2 || 'Reward',
                eventHeadLine3: formData.eventHeadLine3 || 'Rules',
                reward: formData.reward || undefined,
                rules1: formData.rules1 || '',
                rules2: formData.rules2 || '',
                rules3: formData.rules3 || '',
                rules4: formData.rules4 || '',
                btnText: formData.btnText || '',
                btnLink: formData.btnLink || '',
                btnText1: formData.btnText1 || '',
                btnLink1: formData.btnLink1 || '',
                order: Number(formData.order) || 0,
                image: formData.image || '',
                ...participationToPayload(formData),
                // ⚠️ AFTER THE SPREAD, AND THAT ORDER IS LOAD-BEARING.
                // `participationToPayload` carries all twelve schedule fields,
                // `eventStartAt` and `eventEndAt` included, and it emits them as
                // they sit in `formData` — which for this form is the BROWSER
                // wall-clock string `2026-10-01T09:30`, not an instant. Putting
                // these two lines before the spread would let that wall-clock
                // overwrite the ISO below and Mongoose would cast it in the
                // server's own timezone, shifting every save by the server's UTC
                // offset. They go last, they carry the `|| Date.now()` fallback
                // this form has always had, and the `eventEndAt` fallback still
                // reads the start so a half-filled form can never be saved
                // inverted.
                eventStartAt: fromBrowserInputValue(formData.eventStartAt) || new Date().toISOString(),
                eventEndAt: fromBrowserInputValue(formData.eventEndAt) || fromBrowserInputValue(formData.eventStartAt) || new Date().toISOString(),
            };
            await updateItem(editingEvent.id, updatedEvent);
            showSuccessAlert('Event Updated', `"${formData.title}" has been updated.`);
        }
        else {
            const newEvent = {
                title: formData.title,
                description: formData.description,
                location: formData.location,
                type: formData.type,
                status: formData.status,
                organizer: 'CPCCU',
                eventHeadLine1: formData.eventHeadLine1 || formData.title,
                eventHeadLine2: formData.eventHeadLine2 || 'Reward',
                eventHeadLine3: formData.eventHeadLine3 || 'Rules',
                reward: formData.reward || undefined,
                rules1: formData.rules1 || '',
                rules2: formData.rules2 || '',
                rules3: formData.rules3 || '',
                rules4: formData.rules4 || '',
                btnText: formData.btnText || '',
                btnLink: formData.btnLink || '',
                btnText1: formData.btnText1 || '',
                btnLink1: formData.btnLink1 || '',
                order: Number(formData.order) || 0,
                image: formData.image || '',
                ...participationToPayload(formData),
                // ⚠️ AFTER THE SPREAD — same reason as the update branch above, and
                // the same two lines, because the two branches have to stay in step
                // or a create and an edit would save different shapes of the same
                // record.
                eventStartAt: fromBrowserInputValue(formData.eventStartAt) || new Date().toISOString(),
                eventEndAt: fromBrowserInputValue(formData.eventEndAt) || fromBrowserInputValue(formData.eventStartAt) || new Date().toISOString(),
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
            { label: 'Total Events', value: events.length },
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
                const hasLinks = event.btnLink || event.btnLink1;
                // See the ⚠️ block above `filtered`: a hackathon row is shown
                // for visibility but its Edit action is withheld, because this
                // form's browser-timezone date round trip would silently shift
                // the schedule for an admin outside UTC+6.
                //
                // ⚠️ THIS ADMIN GRID IS INTENTIONALLY *NOT* FILTERED BY
                // `isHackathon`, unlike the two public consumers
                // (`NoticeSection` on `/event` and `EventLayout` on the
                // homepage), which both drop hackathon rows. It reads the RAW
                // document via `useAdminContent('events')` rather than going
                // through `toPublicEvent`, and it MUST keep showing the
                // hackathon: the admin toggle and the hackathon's own record
                // live here, so hiding the row would make an admin unable to
                // see or find the thing they are supposed to control. The
                // "is the hackathon live?" decision belongs to the public
                // render path, not to the management surface.
                const isHackathon = event.type === 'hackathon';
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
                      {/* ⚠️ READ FROM THE RAW DOCUMENT, NOT THROUGH `toPublicEvent`.
                          This grid deliberately bypasses that mapper — see the note
                          below — but it still needs to show the admin whether
                          participation is live, because otherwise the switch in the
                          edit dialog is invisible from the list and an admin who has
                          configured forty events has no way to see which are open.

                          The badge says only that the feature is ON, never that
                          registration is currently OPEN. `registrationEnabled` is
                          date-independent: an event switched on six months ago and
                          long finished still reports `true`. Conflating "enabled"
                          with "open" here would repeat the free-text `status`
                          problem the public pages went to such lengths to avoid —
                          the admin list would show "Registration open" beside a
                          completed event. */}
                      {event.registrationEnabled === true ? (
                        <Badge variant="outline" className="border-header/30 bg-header/10 text-xs text-header">
                          Registration in-app
                        </Badge>
                      ) : null}
                      {event.submissionEnabled === true ? (
                        <Badge variant="outline" className="border-header/30 bg-header/10 text-xs text-header">
                          Submissions in-app
                        </Badge>
                      ) : null}
                    </div>
                    <CardTitle className="text-base leading-snug">{event.title}</CardTitle>
                  </div>
                  {isHackathon ? (
                    /* The whole affordance, in place of an Edit button. An admin
                       looking for the hackathon editor finds it here rather than
                       being silently given a form that would corrupt the dates. */
                    <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs" asChild>
                      <Link href={HACKATHON_PATH}>
                        <Settings2 className="size-3.5"/>
                        Managed in Hackathon
                      </Link>
                    </Button>
                  ) : (
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
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-3.5 shrink-0"/>
                      <span>{formatDate(event.eventStartAt, 'MMM dd, yyyy h:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0"/>
                      <span className="truncate">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ListOrdered className="size-3.5 shrink-0"/>
                      <span>Display order: {Number(event.order) || 0}</span>
                    </div>
                    {event.reward && (<div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Gift className="size-3.5 shrink-0"/>
                        <span className="truncate">{event.reward}</span>
                      </div>)}
                  </div>
                  {hasLinks && (<div className="flex flex-wrap gap-1.5 pt-1">
                      {event.btnLink && (<Button variant="outline" size="sm" className="h-6 px-2 text-xs" asChild>
                          <a href={event.btnLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 size-3"/>
                            {event.btnText || 'Open Link'}
                          </a>
                        </Button>)}
                      {event.btnLink1 && (<Button variant="outline" size="sm" className="h-6 px-2 text-xs" asChild>
                          <a href={event.btnLink1} target="_blank" rel="noopener noreferrer">
                            <Link2 className="mr-1 size-3"/>
                            {event.btnText1 || 'Open Link'}
                          </a>
                        </Button>)}
                    </div>)}
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
            {/* ⚠️ FOUR TABS, NOT THREE, AND THE NEW ONE IS LAST ON PURPOSE.
                The participation fields are the only ones here that are OFF by
                default and invisible until configured, so burying them at the end
                keeps the common case — an admin editing a description — exactly as
                short as it was, instead of pushing the description field below the
                fold for every event that will never take registrations. */}
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
              <TabsTrigger value="links">Buttons & Rewards</TabsTrigger>
              <TabsTrigger value="participation">Participation</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-title">Title</Label>
                <Input id="event-title" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Event title"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-headline">Card Headline</Label>
                <Input id="event-headline" value={formData.eventHeadLine1} onChange={(e) => setFormData(prev => ({ ...prev, eventHeadLine1: e.target.value }))} placeholder="Optional public card headline"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-desc">Description</Label>
                <Textarea id="event-desc" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Event description..." rows={3}/>
              </div>
              {/* ⚠️ THE TWO REQUIRED INSTANTS ARE RENDERED FROM THE SHARED
                  DECLARATION, WITH THIS FORM'S OWN (BROWSER-TIMEZONE) CONVERTERS.
                  That is the whole reason `ScheduleInstantField` takes them as props:
                  `EVENT_SCHEDULE_FIELDS` already knows both are required, so the
                  labels and the required mark cannot drift from the contract, while
                  the converters keep this form's documented, deliberately-wrong
                  encoding intact. */}
              <div className="grid grid-cols-2 gap-4">
                {EVENT_SCHEDULE_FIELDS.filter((field) => field.required).map((field) => (
                  <ScheduleInstantField
                    key={field.key}
                    id={`event-${field.key}`}
                    label={field.label}
                    required={field.required}
                    value={formData[field.key]}
                    onChange={(value) => setFormData(prev => ({ ...prev, [field.key]: value }))}
                    toInputValue={toBrowserInputValue}
                    fromInputValue={fromBrowserInputValue}
                  />
                ))}
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                  <Label htmlFor="event-order">Display Order</Label>
                  <Input id="event-order" type="number" value={formData.order} onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}/>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="rules" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-rules-heading">Rules Heading</Label>
                <Input id="event-rules-heading" value={formData.eventHeadLine3} onChange={(e) => setFormData(prev => ({ ...prev, eventHeadLine3: e.target.value }))} placeholder="Rules"/>
              </div>
              {[1, 2, 3, 4].map((ruleNumber) => (
                <div key={ruleNumber} className="flex flex-col gap-2">
                  <Label htmlFor={`event-rule-${ruleNumber}`}>Rule {ruleNumber}</Label>
                  <Input
                    id={`event-rule-${ruleNumber}`}
                    value={formData[`rules${ruleNumber}`]}
                    onChange={(e) => setFormData(prev => ({ ...prev, [`rules${ruleNumber}`]: e.target.value }))}
                    placeholder={`Rule ${ruleNumber}`}
                  />
                </div>
              ))}
            </TabsContent>
            <TabsContent value="links" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-reward-heading">Reward Heading</Label>
                <Input id="event-reward-heading" value={formData.eventHeadLine2} onChange={(e) => setFormData(prev => ({ ...prev, eventHeadLine2: e.target.value }))} placeholder="Reward"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-reward">Reward / Prize (Optional)</Label>
                <Input id="event-reward" value={formData.reward} onChange={(e) => setFormData(prev => ({ ...prev, reward: e.target.value }))} placeholder="e.g. Winners will get certificates and prizes"/>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-button-text">Button 1 Text</Label>
                  <Input id="event-button-text" value={formData.btnText} onChange={(e) => setFormData(prev => ({ ...prev, btnText: e.target.value }))} placeholder="Contest Link"/>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-button-link">Button 1 Link</Label>
                  <Input id="event-button-link" value={formData.btnLink} onChange={(e) => setFormData(prev => ({ ...prev, btnLink: e.target.value }))} placeholder="https://..."/>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-button-text-2">Button 2 Text</Label>
                  <Input id="event-button-text-2" value={formData.btnText1} onChange={(e) => setFormData(prev => ({ ...prev, btnText1: e.target.value }))} placeholder="Group Link"/>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-button-link-2">Button 2 Link</Label>
                  <Input id="event-button-link-2" value={formData.btnLink1} onChange={(e) => setFormData(prev => ({ ...prev, btnLink1: e.target.value }))} placeholder="https://..."/>
                </div>
              </div>
            </TabsContent>
            {/* ⚠️ SHARED WITH `hackathon-content.jsx`, AND IT MUST STAY SHARED.
                These twelve fields are not hackathon-specific — the server's
                resolver reads them from any event with no type check — and two
                editors for one record is already the documented trap above. A third
                copy would be a third place for them to drift, and a drifted switch
                is silent: the server `$set`s the body, so a form that omits a field
                unsets it with a 200 and no error. */}
            <TabsContent value="participation" className="pt-4">
              <EventParticipationSettings
                formData={formData}
                onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
              />
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
