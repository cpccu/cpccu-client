'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ExternalLink, MapPin, MoreHorizontal, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AdminImageUploadField } from '@/components/admin-image-upload-field';
import useAdminContent from '@/hooks/use-admin-content';
import { showDeleteConfirm, showErrorAlert, showSuccessAlert } from '@/lib/alerts';
import {
    DHAKA_TIME_ZONE_LABEL,
    formatDhakaDateTime,
    toDhakaInputValue,
    utcIsoFromDhakaInput,
} from '@/lib/dhaka-time';
import { isSafeHttpUrl, toSafeHref } from '@/lib/hackathon';

/**
 * Admin control surface for the hackathon.
 *
 * THERE IS NO NEW SERVER ENDPOINT. The hackathon is an ordinary `Event`
 * document with `type: 'hackathon'`, written through the existing
 * `/admin/content/events` route. That is why the sidebar roles for this page
 * match `/admin/events` exactly — the page issues no path of its own, so it
 * inherits the events collection's authorisation.
 *
 * THE "CURRENT HACKATHON" RULE IS A MIRROR OF THE SERVER'S
 * ----------------------------------------------------
 * `content.controller.js` resolves the published hackathon as
 * `Event.findOne({ type: 'hackathon', hackathonEnabled: true }).sort({ date: -1 })`.
 * The admin panel must resolve it the same way, or the admin would be editing a
 * record that the public site is not showing. Any change to the server's rule
 * has to be made here in the same commit.
 *
 * TIMEZONE
 * --------
 * `datetime-local` yields a naive wall-clock string with no zone. It is
 * interpreted here as Dhaka time (UTC+6, no DST since 2009) via
 * `utcIsoFromDhakaInput`, so the stored instant is the same regardless of the
 * admin's device timezone. `events-content.jsx:133` instead does
 * `new Date(value).toISOString()`, which interprets the input in the BROWSER's
 * zone — correct for a Dhaka admin, silently wrong for one abroad. That form is
 * deliberately left alone: changing it would rewrite the stored instant of
 * every historical event.
 */

const emptyForm = {
    title: '',
    description: '',
    startAt: '',
    endAt: '',
    location: '',
    organizer: 'CPCCU',
    image: '',
    ctaLabel: 'Register Now',
    ruleBookUrl: '',
    problemSetUrl: '',
    registrationUrl: '',
    submissionUrl: '',
};

/** URL fields on the Event document, paired with the label shown in errors. */
const URL_FIELDS = [
    { key: 'ruleBookUrl', schemaKey: 'hackathonRuleBookUrl', label: 'Rule book URL' },
    { key: 'problemSetUrl', schemaKey: 'hackathonProblemSetUrl', label: 'Problem set URL' },
    { key: 'registrationUrl', schemaKey: 'registrationLink', label: 'Registration URL' },
    // ⚠️ This entry is the ONLY thing that makes the field save. `handleSave`
    // builds the payload by looping `URL_FIELDS` (see the `payload[field.schemaKey]`
    // assignment) and the server's update handler is a `$set` of the raw body —
    // so a form key that is not in this list, or a schema key that is not
    // declared on the model, is silently DROPPED with a 200 and no error
    // anywhere. Adding a URL field to the admin form means adding it here.
    { key: 'submissionUrl', schemaKey: 'hackathonSubmissionUrl', label: 'Project submission URL' },
];

const getErrorMessage = (error) =>
    error?.data?.message || error?.error || error?.message || 'Something went wrong.';

/**
 * Maximum page size the server accepts for `GET /admin/content/:resource`.
 * `listAdminContent` clamps with `Math.min(Math.max(Number(limit) || 100, 1), 200)`,
 * so 200 is the ceiling — asking for more is silently capped, not rejected.
 */
const MAX_EVENTS_PAGE_SIZE = 200;

export function HackathonContent() {
    // ⚠️ THE HACKATHON LIST IS THE FIRST `limit` EVENT RECORDS, NOT ALL OF THEM.
    // This page resolves the published hackathon out of the same `events`
    // collection every other admin page reads, and that endpoint is PAGED. The
    // server's DEFAULT is `limit: 100`; this page explicitly asks for the
    // maximum the server will serve (200) rather than relying on that default.
    //
    // The consequence of getting this wrong is not cosmetic: a hackathon older
    // than the returned window is simply INVISIBLE here, which makes the
    // "No hackathon yet" empty state appear and invites an admin to create a
    // DUPLICATE of a record that is still published on the public site. There
    // is no server-side `type` filter on this endpoint, so the page size is the
    // only completeness control available from the client. If the club ever
    // accumulates more than 200 events, this needs a real server-side filter
    // (`?type=hackathon`) — do not raise the number past the server's cap.
    const { items: events, isLoading, error, createItem, updateItem, deleteItem } =
        useAdminContent('events', [], { limit: MAX_EVENTS_PAGE_SIZE });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingHackathon, setEditingHackathon] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Only `type === 'hackathon'` documents are relevant here. The Events page
    // still lists them alongside everything else; this page is the focused view.
    const hackathons = useMemo(
        () => events.filter((event) => event.type === 'hackathon'),
        [events]
    );

    // ⚠️ MIRROR OF `currentHackathonQuery` ON THE SERVER. Enabled first, then
    // the latest `date` wins. Never filter on the dates here: the hackathon is
    // meant to stay published after it ends until an admin turns it off.
    const currentHackathon = useMemo(() => {
        return hackathons
            .filter((hackathon) => hackathon.hackathonEnabled)
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0] || null;
    }, [hackathons]);

    const enabledCount = useMemo(
        () => hackathons.filter((hackathon) => hackathon.hackathonEnabled).length,
        [hackathons]
    );

    const openCreate = () => {
        setEditingHackathon(null);
        setFormData({ ...emptyForm });
        setFormError('');
        setDialogOpen(true);
    };

    const openEdit = (hackathon) => {
        setEditingHackathon(hackathon);
        setFormData({
            title: hackathon.title || '',
            description: hackathon.description || '',
            // Rendered through the Dhaka formatter, NOT `date.slice(0, 16)`:
            // a UTC slice would show the stored instant six hours off from the
            // wall-clock the admin originally typed, and re-saving it would
            // silently shift the event.
            startAt: toDhakaInputValue(hackathon.date),
            endAt: toDhakaInputValue(hackathon.endDate),
            location: hackathon.location || '',
            organizer: hackathon.organizer || 'CPCCU',
            image: hackathon.image || '',
            ctaLabel: hackathon.hackathonCtaLabel || 'Register Now',
            ruleBookUrl: hackathon.hackathonRuleBookUrl || '',
            problemSetUrl: hackathon.hackathonProblemSetUrl || '',
            registrationUrl: hackathon.registrationLink || '',
            submissionUrl: hackathon.hackathonSubmissionUrl || '',
        });
        setFormError('');
        setDialogOpen(true);
    };

    const handleToggleEnabled = async (hackathon, nextEnabled) => {
        try {
            // A minimal `$set` — the server's `updateAdminContent` builds
            // `{ $set: req.body }`, so sending only the flag cannot clobber the
            // rest of the document.
            await updateItem(hackathon.id, { hackathonEnabled: nextEnabled });
            showSuccessAlert(
                nextEnabled ? 'Hackathon published' : 'Hackathon hidden',
                nextEnabled
                    ? `"${hackathon.title}" is now live on the website.`
                    : `"${hackathon.title}" is no longer shown to visitors.`
            );
        } catch (error) {
            showErrorAlert('Update failed', getErrorMessage(error));
        }
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            setFormError('Title is required.');
            return;
        }

        // `date` and `endDate` are `required: true` on the Event schema, so the
        // server would reject this with a 400 anyway. Blocking here gives the
        // admin the error next to the field instead of in a SweetAlert.
        if (!formData.startAt || !formData.endAt) {
            setFormError('Start and end times are required — a hackathon cannot be scheduled without them.');
            return;
        }

        const startIso = utcIsoFromDhakaInput(formData.startAt);
        const endIso = utcIsoFromDhakaInput(formData.endAt);

        if (!startIso || !endIso) {
            setFormError('Start and end times could not be read. Please re-enter them.');
            return;
        }

        // Mirrors the server's `assertHackathonWindow`. An inverted window
        // resolves to the 'unannounced' phase forever, so it is a data error
        // worth refusing rather than storing.
        if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
            setFormError('A hackathon must end after it starts.');
            return;
        }

        // Client-side mirror of the server's URL policy. UX only — the server
        // is still the gate, and a value this check rejects is exactly what the
        // server would 400 on.
        for (const field of URL_FIELDS) {
            const value = formData[field.key];

            if (value && !isSafeHttpUrl(value)) {
                setFormError(`${field.label} must be a valid http(s) URL.`);
                return;
            }
        }

        const payload = {
            type: 'hackathon',
            title: formData.title.trim(),
            description: formData.description,
            date: startIso,
            endDate: endIso,
            location: formData.location,
            organizer: formData.organizer,
            image: formData.image,
            // ⚠️ `status` IS ADMIN-ONLY BOOKKEEPING, NOT THE SOURCE OF TRUTH
            // FOR PHASE — and it is deliberately carried through here even
            // though no field on this form edits it. Two reasons, both load
            // bearing:
            //
            //   1. The server's update handler is `$set: req.body`. This form
            //      builds a FULL replacement payload, so a field that is not
            //      re-sent is UNSET by the save. The generic Events form on
            //      `/admin/events` spreads `...editingEvent`, so its saves are
            //      safe; this form deliberately does not, so anything omitted
            //      here would be silently cleared. Hence the explicit
            //      `editingHackathon?.status`.
            //   2. It is the value the admin's own Events-page card shows, and
            //      the value `statusStyles` / the type filter key off.
            //
            // It is NOT what the public page displays. The public payload does
            // not carry `status` at all (see `toPublicHackathon`): the server
            // derives `phase` from `date`/`endDate`, and a hand-set free-text
            // `status` can permanently disagree with it. Do not wire it into
            // any public component, and do not delete it on the assumption it
            // is vestigial — that is what a `$set` save would do.
            status: editingHackathon?.status || 'upcoming',
            hackathonCtaLabel: formData.ctaLabel || 'Register Now',
        };

        for (const field of URL_FIELDS) {
            payload[field.schemaKey] = formData[field.key] || '';
        }

        setIsSaving(true);
        setFormError('');

        try {
            if (editingHackathon) {
                // The toggle is carried through explicitly so that saving the
                // form can never silently unpublish a live hackathon (or
                // publish a hidden one).
                await updateItem(editingHackathon.id, {
                    ...payload,
                    hackathonEnabled: Boolean(editingHackathon.hackathonEnabled),
                });
                showSuccessAlert('Hackathon updated', `"${payload.title}" has been updated.`);
            } else {
                // `hackathonEnabled: false` on create: the master toggle is the
                // only publishing action, so a new hackathon is never live by
                // accident.
                await createItem({ ...payload, hackathonEnabled: false });
                showSuccessAlert('Hackathon created', `"${payload.title}" has been created. Turn it on below to publish it.`);
            }
            setDialogOpen(false);
        } catch (error) {
            // Kept inline (doc.md §10.8): the failure is attached to this form
            // and must not steal focus with a modal.
            setFormError(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (hackathon) => {
        const result = await showDeleteConfirm(hackathon.title);

        if (!result.isConfirmed) return;

        try {
            await deleteItem(hackathon.id);
            showSuccessAlert('Deleted', `"${hackathon.title}" has been deleted.`);
        } catch (error) {
            showErrorAlert('Delete failed', getErrorMessage(error));
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="mt-2 h-4 w-72" />
                </div>
                <Skeleton className="h-40 w-full rounded-lg" />
            </div>
        );
    }

    // A failed list request must not be mistaken for "no hackathon exists" —
    // that would invite an admin to create a duplicate of a record that is
    // already published. Surface the failure and stop.
    if (error) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-balance">Hackathon</h1>
                    <p className="text-muted-foreground">
                        Publish, schedule and gate the club hackathon.
                    </p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p>Could not load the event list. {getErrorMessage(error)}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-balance">Hackathon</h1>
                    <p className="text-muted-foreground">
                        Publish, schedule and gate the club hackathon. The toggle below controls
                        the public page and the navigation entry.
                    </p>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="size-4" />
                    Create hackathon
                </Button>
            </div>

            {/* State banner. More than one enabled record is a data-entry mistake,
                not an error the server rejects, so it is surfaced here — naming
                the record that is actually live, which is the whole reason this
                resolution rule has to match the server's. */}
            {enabledCount > 1 && currentHackathon ? (
                <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    <p>
                        <span className="font-semibold">
                            {enabledCount} hackathons are switched on.
                        </span>{' '}
                        Only the most recently scheduled one — &ldquo;{currentHackathon.title}&rdquo; —
                        is shown to visitors. Switch the others off to avoid confusion.
                    </p>
                </div>
            ) : null}

            {hackathons.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                            <Trophy className="size-8 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-lg font-semibold">No hackathon yet</h2>
                            <p className="max-w-md text-sm text-muted-foreground">
                                Create the hackathon record, set its schedule, then switch it on to
                                publish it to the website.
                            </p>
                        </div>
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="size-4" />
                            Create hackathon
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {hackathons.map((hackathon) => {
                        const isCurrent = currentHackathon?.id === hackathon.id;

                        return (
                            <Card key={hackathon.id} className="flex flex-col">
                                <CardHeader className="flex flex-row items-start justify-between pb-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                            {/* ADMIN-SIDE ONLY. `status` is the raw
                                                Event field, read here from the
                                                un-projected document via
                                                `useAdminContent('events')` — it is
                                                NOT in the public payload and must
                                                never be used to decide the phase. */}
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {hackathon.status || 'upcoming'}
                                            </Badge>
                                            {hackathon.hackathonEnabled ? (
                                                <Badge className="text-xs">Published</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                                    Hidden
                                                </Badge>
                                            )}
                                            {isCurrent ? (
                                                <Badge variant="secondary" className="text-xs">
                                                    Live on site
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <CardTitle className="text-base leading-snug">
                                            {hackathon.title}
                                        </CardTitle>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="size-8 shrink-0">
                                                <MoreHorizontal className="size-4" />
                                                <span className="sr-only">Actions</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEdit(hackathon)}>
                                                <Pencil className="mr-2 size-4" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(hackathon)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="mr-2 size-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardHeader>
                                <CardContent className="flex flex-1 flex-col gap-3">
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {hackathon.description}
                                    </p>
                                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="size-3.5 shrink-0" />
                                            <span>
                                                {formatDhakaDateTime(hackathon.date)} →{' '}
                                                {formatDhakaDateTime(hackathon.endDate)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="size-3.5 shrink-0" />
                                            <span className="truncate">{hackathon.location || '—'}</span>
                                        </div>
                                        {hackathon.hackathonRuleBookUrl ? (
                                            <div className="flex items-center gap-2">
                                                <ExternalLink className="size-3.5 shrink-0" />
                                                {/* Admin-side link: plain anchor with
                                                    noopener/noreferrer, same rule as
                                                    the public components.
                                                    ⚠️ `toSafeHref` applied even though
                                                    the admin can only have written a
                                                    value the server already validated.
                                                    The documented case for it is a URL
                                                    stored BEFORE the validator existed,
                                                    or hand-edited in Mongo — and this
                                                    file already imports `isSafeHttpUrl`
                                                    for the write path, so the read path
                                                    being weaker than the write path was
                                                    an inconsistency. `|| undefined`
                                                    drops the attribute entirely rather
                                                    than emitting `href=""`. */}
                                                <a
                                                    href={toSafeHref(hackathon.hackathonRuleBookUrl) || undefined}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="truncate underline"
                                                >
                                                    Rule book
                                                </a>
                                            </div>
                                        ) : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        All times {DHAKA_TIME_ZONE_LABEL}.
                                    </p>

                                    {/* THE MASTER TOGGLE.
                                        This is the control the product owner asked
                                        for: it is the only thing that decides
                                        whether `GET /content/hackathon` returns
                                        200 or 404, and therefore whether the nav
                                        entry and the page exist. */}
                                    <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
                                        <Label htmlFor={`hackathon-toggle-${hackathon.id}`} className="text-sm">
                                            {hackathon.hackathonEnabled ? 'Live on site' : 'Hidden from visitors'}
                                        </Label>
                                        <Switch
                                            id={`hackathon-toggle-${hackathon.id}`}
                                            checked={Boolean(hackathon.hackathonEnabled)}
                                            onCheckedChange={(checked) =>
                                                handleToggleEnabled(hackathon, checked)
                                            }
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingHackathon ? 'Edit Hackathon' : 'Create Hackathon'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingHackathon
                                ? 'Update the schedule, links and details.'
                                : 'Set the schedule and details. The hackathon is created hidden — switch it on to publish it.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-title">Title</Label>
                            <Input
                                id="hackathon-title"
                                value={formData.title}
                                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="CPCCU Hackathon 2026"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-desc">Description</Label>
                            <Textarea
                                id="hackathon-desc"
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="What is this hackathon about?"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="hackathon-start">
                                    Start (Dhaka time, UTC+6)
                                </Label>
                                <Input
                                    id="hackathon-start"
                                    type="datetime-local"
                                    value={formData.startAt}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, startAt: e.target.value }))}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="hackathon-end">
                                    End (Dhaka time, UTC+6)
                                </Label>
                                <Input
                                    id="hackathon-end"
                                    type="datetime-local"
                                    value={formData.endAt}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, endAt: e.target.value }))}
                                />
                            </div>
                        </div>
                        <p className="-mt-2 text-xs text-muted-foreground">
                            Entered wall-clock time is stored as Dhaka time (UTC+6, no daylight
                            saving), so the published schedule is identical for every viewer.
                        </p>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-venue">Venue</Label>
                            <Input
                                id="hackathon-venue"
                                value={formData.location}
                                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                                placeholder="Main Auditorium, Block A or Online"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-organizer">Organiser</Label>
                            <Input
                                id="hackathon-organizer"
                                value={formData.organizer}
                                onChange={(e) => setFormData((prev) => ({ ...prev, organizer: e.target.value }))}
                            />
                        </div>

                        <AdminImageUploadField
                            id="hackathon-image"
                            label="Hackathon Image"
                            folder="cpccu/hackathon"
                            value={formData.image}
                            onChange={(value) => setFormData((prev) => ({ ...prev, image: value }))}
                        />

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-cta">Registration button label</Label>
                            <Input
                                id="hackathon-cta"
                                value={formData.ctaLabel}
                                onChange={(e) => setFormData((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                                placeholder="Register Now"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-registration">Registration URL</Label>
                            <Input
                                id="hackathon-registration"
                                value={formData.registrationUrl}
                                onChange={(e) => setFormData((prev) => ({ ...prev, registrationUrl: e.target.value }))}
                                placeholder="https://..."
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-rulebook">Rule book URL</Label>
                            <Input
                                id="hackathon-rulebook"
                                value={formData.ruleBookUrl}
                                onChange={(e) => setFormData((prev) => ({ ...prev, ruleBookUrl: e.target.value }))}
                                placeholder="https://drive.google.com/file/d/..."
                            />
                            {/* Must name BOTH accepted hosts: `deriveEmbeddableUrl`
                                recognises Google Drive `/file/d/…` AND Google Docs
                                `/document/d/…` (the "Share → Link" form of a Doc),
                                plus the `docs.google.com/gview` viewer. Anything else
                                falls back to an "open in a new tab" card. A hint that
                                only mentioned Drive would be misleading about a
                                perfectly valid Docs link. */}
                            <p className="text-xs text-muted-foreground">
                                A Google Drive or Google Docs link is embedded on the page. Any
                                other host opens in a new tab instead.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-problemset">Problem set URL</Label>
                            <Input
                                id="hackathon-problemset"
                                value={formData.problemSetUrl}
                                onChange={(e) => setFormData((prev) => ({ ...prev, problemSetUrl: e.target.value }))}
                                placeholder="https://..."
                            />
                            <p className="text-xs text-muted-foreground">
                                Only released to signed-in members once the hackathon has started.
                                It is never included in any public payload.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hackathon-submission">Project submission URL</Label>
                            <Input
                                id="hackathon-submission"
                                value={formData.submissionUrl}
                                onChange={(e) => setFormData((prev) => ({ ...prev, submissionUrl: e.target.value }))}
                                placeholder="https://docs.google.com/forms/..."
                            />
                            {/* ⚠️ The wording here is load-bearing on two counts.
                                First, the visibility rule is PHASE-DERIVED and this
                                field has no switch: an admin "turns it on" by
                                publishing a URL, and "turns it off" by clearing it.
                                Second, and more easily misread: this URL is PUBLIC
                                from kickoff onwards, unlike the problem set above,
                                which is gated until the hackathon starts. That is
                                intended — a participant must be able to FIND the
                                form to submit at all. Do not "fix" this by gating
                                it; the form's own response settings are the real
                                deadline, which is also why the page keeps showing
                                it after `endAt`. */}
                            <p className="text-xs text-muted-foreground">
                                A Google Form (or any external form) participants submit their
                                project through. Shown publicly from the moment the hackathon
                                starts, and it stays visible after it ends. Clear this field to
                                hide it.
                            </p>
                        </div>

                        {formError ? (
                            <p role="alert" className="text-sm font-medium text-destructive">
                                {formError}
                            </p>
                        ) : null}
                    </div>

                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {editingHackathon ? 'Save Changes' : 'Create Hackathon'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
