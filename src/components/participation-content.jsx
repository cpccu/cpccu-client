'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import {
    AlertTriangle,
    Check,
    ExternalLink,
    Inbox,
    Loader2,
    ShieldAlert,
    Trophy,
    Users,
    X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showErrorAlert, showSuccessAlert } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
// `isSafeHttpUrl` is imported for the MEMBER-AUTHORED submission links below.
// Those URLs are not admin-authored, but they are just as attacker-controlled: a
// member who can fill in a form can put any string in those fields. Same read-time
// backstop as every admin-authored href, same helper — not a second policy.
import { isSafeHttpUrl } from '@/lib/hackathon';
import useAdminContent from '@/hooks/use-admin-content';
import {
    useGetAdminParticipationRegistrationsQuery,
    useGetAdminParticipationSubmissionsQuery,
    useReviewParticipationSubmissionMutation,
} from '@/features/participation/participationApi';
import { getParticipationErrorMessage } from '@/lib/participation';

/**
 * Admin review surface for event registrations and submissions.
 *
 * ⚠️ ONE EVENT AT A TIME, CHOSEN BY THE ADMIN, NOT A GLOBAL QUEUE.
 * Both server endpoints require an `eventId` and 400 without one, and that is the
 * right shape for this data rather than a limitation: reviewing a hackathon's
 * submissions while looking at a bootcamp's registrations is not a thing anyone
 * needs, and a single global queue would have to invent a grouping the data does
 * not carry. The picker defaults to the first event that has participation
 * switched on, because an event with it off has nothing to review by definition.
 *
 * ⚠️ ROLES ARE NOT SYMMETRIC, AND THE PAGE ENFORCES IT. A moderator and a mentor
 * may BOTH read these two lists (`authorizeAdminAction` permits GET for both),
 * but only an admin may shortlist or reject. A mentor gets 403 on the lists too.
 * The review ACTIONS are therefore gated on `role === 'admin'` in the UI, and the
 * lists are hidden entirely from mentors — offering a mentor a page whose every
 * fetch 403s teaches them the panel is broken rather than that it is not for them.
 *
 * ⚠️ `shortlisted → submitted` IS NOT OFFERED, BECAUSE IT IS NOT ALLOWED. The
 * server 409s it, and deliberately: shortlisting PUBLISHES an entry on the public
 * winners gallery, so undoing it that way would silently un-publish something
 * visitors may already have seen. The only way back is to reject it. A UI that
 * offered "move to submitted" as a reversible-looking action would be lying about
 * a one-way door.
 *
 * ⚠️ A REGISTRATION BELOW THE EVENT'S `teamMinSize` IS SHOWN WITH A WARNING, NOT
 * FILTERED OUT. The server returns it — it is a review list, and the under-sized
 * team is exactly what a reviewer needs to see and decide about. Filtering it here
 * would hide a real problem behind a clean-looking list.
 */
export function ParticipationContent() {
    const user = useSelector((state) => state.auth.user);
    const role = user?.roles?.role;
    // Read access: admin and moderator. Mentor is excluded — the server 403s.
    const canRead = role === 'admin' || role === 'moderator';
    // Write access: admin only. A moderator can read but not review.
    const canReview = role === 'admin';

    const { items: events } = useAdminContent('events', [], { limit: 200 });

    // ⚠️ ONLY EVENTS WITH PARTICIPATION SWITCHED ON ARE OFFERED. An event with
    // both toggles off cannot have a registration, so listing all forty events
    // would bury the two that matter behind a wall of dead ends — and every
    // selection of the wrong one is a 200 with an empty array, which looks like
    // "nobody has registered" rather than "this event is not configured".
    const reviewableEvents = useMemo(
        () =>
            events.filter(
                (event) =>
                    event.registrationEnabled === true || event.submissionEnabled === true
            ),
        [events]
    );

    const [selectedEventId, setSelectedEventId] = useState('');
    const [registrationFilter, setRegistrationFilter] = useState('registered');
    const [submissionFilter, setSubmissionFilter] = useState('submitted');
    const [draftNotes, setDraftNotes] = useState({});

    // Falls back to the first reviewable event once the list arrives, so the
    // admin lands on something useful instead of an empty "pick an event" state.
    const activeEventId =
        selectedEventId && reviewableEvents.some((e) => e.id === selectedEventId)
            ? selectedEventId
            : reviewableEvents[0]?.id || '';

    const activeEvent = reviewableEvents.find((e) => e.id === activeEventId);
    const windowLoaded = Boolean(activeEvent);

    const registrationsQuery = useGetAdminParticipationRegistrationsQuery(
        { eventId: activeEventId, status: registrationFilter, limit: 200 },
        { skip: !canRead || !activeEventId }
    );

    const submissionsQuery = useGetAdminParticipationSubmissionsQuery(
        { eventId: activeEventId, status: submissionFilter, limit: 200 },
        { skip: !canRead || !activeEventId }
    );

    const [reviewSubmission, { isLoading: isReviewing }] =
        useReviewParticipationSubmissionMutation();

    const registrations = registrationsQuery.data?.data?.items ?? [];
    const submissions = submissionsQuery.data?.data?.items ?? [];

    const handleReview = async (submission, status) => {
        const rawNote = draftNotes[submission._id] ?? '';
        const note = rawNote.trim();

        try {
            await reviewSubmission({
                id: submission._id,
                status,
                // ⚠️ `reviewNote` IS SENT EVEN WHEN EMPTY. It is a string, the
                // server accepts `''`, and omitting the key means "leave the
                // existing note alone" — which is right for a status-only change
                // but WRONG for the common case of an admin re-reviewing an entry
                // and clearing a stale note: the note they visibly deleted from the
                // textarea would survive in the database and keep being shown to
                // the participant. Sending it always keeps the field in step with
                // what is on screen.
                reviewNote: note,
                // ⚠️ NOT A REQUEST FIELD. It never reaches the server — the
                // `query` above destructures only `{ id, status, reviewNote }` —
                // and exists solely as the fallback for the tag invalidation when
                // the response cannot be read. `eventId` on every admin submission
                // payload is the primary source; see the note there.
                eventId: activeEventId,
            }).unwrap();

            setDraftNotes((current) => {
                const next = { ...current };
                delete next[submission._id];
                return next;
            });

            showSuccessAlert(
                status === 'shortlisted' ? 'Entry shortlisted' : 'Entry rejected',
                status === 'shortlisted'
                    ? `"${submission.title}" is now published on the event's winners list.`
                    : `"${submission.title}" has been rejected.`
            );
        } catch (error) {
            // ⚠️ THE 409 IS EXPECTED AND ITS MESSAGE IS SHOWN AS-IS. Two reviewers
            // can race, and shortlisting something already shortlisted is a 409
            // with a message written for exactly this situation. Swallowing it
            // behind a generic failure would make the reviewer think their action
            // worked.
            showErrorAlert(
                'Could not update this entry',
                getParticipationErrorMessage(error, 'Something went wrong. Please try again.')
            );
        }
    };

    if (!canRead) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <ShieldAlert className="size-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                        Reviewing registrations and submissions is available to admins and
                        moderators.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-balance">
                    Participation review
                </h1>
                <p className="text-muted-foreground">
                    Registrations and project submissions for an event.
                    {!canReview
                        ? ' As a moderator you can read these lists; shortlisting and rejecting are restricted to admins.'
                        : ''}
                </p>
            </div>

            {reviewableEvents.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <Inbox className="size-8 text-muted-foreground" />
                        <p className="font-medium">No event has participation switched on</p>
                        <p className="max-w-md text-sm text-muted-foreground">
                            Turn on &quot;In-app registration&quot; or &quot;In-app
                            submissions&quot; on an event to review the people who enter.
                        </p>
                        <Button variant="outline" asChild className="mt-2">
                            <Link href="/admin/events">Go to Events</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* ── The event picker ───────────────────────────────────── */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col gap-2">
                                <label
                                    htmlFor="participation-event"
                                    className="text-sm font-semibold"
                                >
                                    Event
                                </label>
                                <Select value={activeEventId} onValueChange={setSelectedEventId}>
                                    <SelectTrigger id="participation-event">
                                        <SelectValue placeholder="Choose an event" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {reviewableEvents.map((event) => (
                                            <SelectItem key={event.id} value={event.id}>
                                                {event.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {/* ⚠️ THE PUBLIC PAGE IS LINKED FROM HERE, not from a
                                    "preview" that re-renders the event. A reviewer needs
                                    to see the page a member sees — including whether the
                                    winners gallery already lists the entry they are about
                                     to shortlist — and a preview would answer a different
                                     question than the one they are asking. */}
                                {activeEvent ? (
                                    <a
                                        href={`/event/${activeEvent.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-medium text-header underline underline-offset-4 hover:text-header-hover"
                                    >
                                        View the public event page
                                        <span className="sr-only">(opens in a new tab)</span>
                                        <ExternalLink className="size-3.5" />
                                    </a>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Registrations ──────────────────────────────────────── */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                            <CardTitle className="inline-flex items-center gap-2 text-lg">
                                <Users className="size-5 text-header" />
                                Registrations
                            </CardTitle>
                            <Select
                                value={registrationFilter}
                                onValueChange={setRegistrationFilter}
                            >
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="registered">Active</SelectItem>
                                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                                    <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent>
                            {registrationsQuery.isLoading ? (
                                <div className="flex flex-col gap-2">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : registrations.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No registrations to show.
                                </p>
                            ) : (
                                <ul className="flex flex-col divide-y divide-border">
                                    {registrations.map((registration) => {
                                        // ⚠️ THE UNDER-SIZED-TEAM WARNING. The server
                                        // returns these rather than filtering them,
                                        // because the review list is where a reviewer
                                        // needs to see one. `window` is absent when the
                                        // admin's own window query has not resolved, so
                                        // the warning is skipped rather than guessed —
                                        // a spurious "below minimum" would be worse than
                                        // a late one.
                                        const underMin =
                                            windowLoaded &&
                                            activeEvent?.teamMinSize >= 2 &&
                                            registration.memberCount < activeEvent.teamMinSize;

                                        return (
                                            <li
                                                key={registration._id}
                                                className="flex flex-col gap-2 py-4"
                                            >
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium">
                                                        {registration.name}
                                                    </span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {registration.kind === 'solo'
                                                            ? 'Solo'
                                                            : `${registration.memberCount} members`}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            registration.status === 'registered'
                                                                ? 'border-success/30 bg-success/10 text-xs text-success'
                                                                : 'text-xs text-muted-foreground'
                                                        }
                                                    >
                                                        {registration.status}
                                                    </Badge>
                                                    {underMin ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-destructive/40 bg-destructive/10 text-xs text-destructive"
                                                        >
                                                            <AlertTriangle className="mr-1 size-3" />
                                                            Below team minimum
                                                        </Badge>
                                                    ) : null}
                                                </div>

                                                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                    {registration.members.map((member) => (
                                                        <li key={member._id}>
                                                            <span className="text-foreground">
                                                                {member.fullName || 'Unnamed'}
                                                            </span>{' '}
                                                            · {member.uniID || 'no ID'}
                                                            {member.role === 'captain' ? (
                                                                <span className="ml-1 text-xs">
                                                                    (captain)
                                                                </span>
                                                            ) : null}
                                                        </li>
                                                    ))}
                                                </ul>

                                                <p className="text-xs text-muted-foreground">
                                                    Registered{' '}
                                                    {formatDate(registration.createdAt)}
                                                </p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Submissions ────────────────────────────────────────── */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                            <CardTitle className="inline-flex items-center gap-2 text-lg">
                                <Trophy className="size-5 text-header" />
                                Submissions
                            </CardTitle>
                            <Select
                                value={submissionFilter}
                                onValueChange={setSubmissionFilter}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="submitted">Awaiting review</SelectItem>
                                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent>
                            {submissionsQuery.isLoading ? (
                                <div className="flex flex-col gap-2">
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            ) : submissions.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No submissions to show.
                                </p>
                            ) : (
                                <ul className="flex flex-col divide-y divide-border">
                                    {submissions.map((submission) => (
                                        <SubmissionRow
                                            key={submission._id}
                                            submission={submission}
                                            canReview={canReview}
                                            isReviewing={isReviewing}
                                            note={draftNotes[submission._id] ?? ''}
                                            onNoteChange={(value) =>
                                                setDraftNotes((current) => ({
                                                    ...current,
                                                    [submission._id]: value,
                                                }))
                                            }
                                            onReview={handleReview}
                                        />
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

/**
 * One submission, with its review controls.
 *
 * ⚠️ THE ACTIONS AVAILABLE DEPEND ON THE CURRENT STATUS, and the set is derived
 * from the server's state machine rather than from what looks reasonable:
 *
 *   submitted   → Shortlist, Reject
 *   shortlisted → Reject only. "Move to submitted" is a 409 because shortlisting
 *                 PUBLISHES the entry, and un-publishing by quietly moving the
 *                 status back would contradict a page visitors may already have
 *                 loaded. The only honest path back is to reject it, which is why
 *                 the hint says so rather than the button simply being absent.
 *   rejected    → Shortlist only (re-rejecting is a no-op worth not offering).
 *
 * Every transition writes an audit-log row server-side, so an admin's decisions are
 * attributable without this component doing anything about it.
 */
function SubmissionRow({
    submission,
    canReview,
    isReviewing,
    note,
    onNoteChange,
    onReview,
}) {
    const status = submission.status;
    const isAwaiting = status === 'submitted';

    return (
        <li className="flex flex-col gap-3 py-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{submission.title}</span>
                <Badge
                    variant="outline"
                    className={
                        status === 'shortlisted'
                            ? 'border-success/30 bg-success/10 text-xs text-success'
                            : status === 'rejected'
                              ? 'border-destructive/40 bg-destructive/10 text-xs text-destructive'
                              : 'text-xs'
                    }
                >
                    {status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                    {submission.kind === 'solo' ? 'Solo' : submission.registrationName}
                </Badge>
            </div>

            {submission.description ? (
                <p className="break-words text-sm text-muted-foreground">
                    {submission.description}
                </p>
            ) : null}

            {/* ⚠️ THESE LINKS ARE MEMBER-AUTHORED, NOT ADMIN-AUTHORED, and they get
                the same treatment anyway: a member who can fill in a form can put
                any string in these fields, so they pass through `toSafeHttpUrl`
                before reaching an `href`, and are rendered as plain anchors with
                `rel="noopener noreferrer"`. A reviewer clicking a submission link
                is exactly as able to be phished by it as a member is. */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {submission.repoUrl && isSafeHttpUrl(submission.repoUrl) ? (
                    <a
                        href={submission.repoUrl.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-header underline underline-offset-4 hover:text-header-hover"
                    >
                        Repository
                        <span className="sr-only">(opens in a new tab)</span>
                        <ExternalLink className="size-3.5" />
                    </a>
                ) : null}
                {submission.liveUrl && isSafeHttpUrl(submission.liveUrl) ? (
                    <a
                        href={submission.liveUrl.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-header underline underline-offset-4 hover:text-header-hover"
                    >
                        Demo
                        <span className="sr-only">(opens in a new tab)</span>
                        <ExternalLink className="size-3.5" />
                    </a>
                ) : null}
            </div>

            {submission.technologies?.length ? (
                <ul className="flex flex-wrap gap-1.5">
                    {submission.technologies.map((technology) => (
                        <li
                            key={technology}
                            className="rounded-full bg-header/10 px-2.5 py-0.5 text-xs font-medium text-header"
                        >
                            {technology}
                        </li>
                    ))}
                </ul>
            ) : null}

            <p className="text-xs text-muted-foreground">
                Submitted {formatDate(submission.createdAt)} by{' '}
                {submission.members
                    ?.map((member) => member.fullName || member.uniID)
                    .join(', ')}
            </p>

            {/* ⚠️ THE EXISTING REVIEW NOTE IS SHOWN, NOT EDITED IN PLACE. An admin
                changing a status and leaving the note alone should see what they
                are about to overwrite, rather than discovering it afterwards. */}
            {submission.reviewNote ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <span className="font-medium">Existing note: </span>
                    {submission.reviewNote}
                </p>
            ) : null}

            {canReview ? (
                <div className="flex flex-col gap-2">
                    <label htmlFor={`note-${submission._id}`} className="text-sm font-medium">
                        Review note (the participant sees this)
                    </label>
                    <Textarea
                        id={`note-${submission._id}`}
                        value={note}
                        onChange={(e) => onNoteChange(e.target.value)}
                        placeholder="Why was this entry shortlisted or rejected?"
                        rows={2}
                        // The server's `MAX_REVIEW_NOTE_LENGTH` is 500, enforced
                        // after trimming. Matching it on the input means an admin is
                        // never told "must be 500 characters or fewer" for text the
                        // field physically let them type.
                        maxLength={500}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                        {isAwaiting || status === 'rejected' ? (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isReviewing}
                                onClick={() => onReview(submission, 'shortlisted')}
                                className="gap-1.5"
                            >
                                {isReviewing ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <Check className="size-3.5" />
                                )}
                                Shortlist
                            </Button>
                        ) : null}

                        {isAwaiting || status === 'shortlisted' ? (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isReviewing}
                                onClick={() => onReview(submission, 'rejected')}
                                className="gap-1.5"
                            >
                                {isReviewing ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <X className="size-3.5" />
                                )}
                                Reject
                            </Button>
                        ) : null}

                        {/* ⚠️ WHY THE SHORTLISTED ROW EXPLAINS ITSELF INSTEAD OF
                            JUST OFFERING "REJECT". The admin's instinct after a
                            mis-click is to put the entry back, and silently omitting
                            the button they are looking for produces a support
                            question. Saying why the door is one-way is more useful
                            than the absence is confusing. */}
                        {status === 'shortlisted' ? (
                            <p className="text-xs text-muted-foreground">
                                Shortlisted entries are published on the event&apos;s winners
                                list, so they cannot be moved back to the review queue —
                                reject it instead.
                            </p>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </li>
    );
}
