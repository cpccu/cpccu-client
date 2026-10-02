'use client';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Info, Send, UserCheck } from 'lucide-react';
import { utcIsoFromDhakaInput, toDhakaInputValue } from '@/lib/dhaka-time';

/**
 * The six participation fields, as a form section.
 *
 * Shared by `events-content.jsx` and `hackathon-content.jsx` because they are two
 * editors for the same `Event` document and these six fields are NOT hackathon
 * specific. That is the whole design premise of the feature: the server's
 * `resolveEventParticipationWindow` reads them from any event object with no type
 * check at all, which is what lets a workshop, a lecture or a bootcamp use the
 * same registration flow a hackathon does.
 *
 * Two editors for one record is already a trap in this codebase — see the long
 * note in `events-content.jsx` about the two different date/timezone round trips.
 * Adding a third copy of these six fields would create a third place for them to
 * drift, and the drift would be silent: the fields are stored by `$set`, so a form
 * that omits one UNSETS it with a 200 and no error anywhere.
 *
 * Props:
 *   formData  — the parent form's state object
 *   onChange  — called with a PARTIAL patch; the parent merges it. Same contract
 *               as `AdminImageUploadField`, for the same reason.
 *
 * ⚠️ THE MODE IS `registrationEnabled` ITSELF. THERE IS NO EXTRA TOGGLE, and that
 * is the decision this component encodes:
 *
 *   `registrationEnabled === true`  → the in-app registration page
 *   otherwise, if `registrationLink` is set → that external form
 *   otherwise                        → no register button at all
 *
 * So the switch IS the admin's choice between the two flows, and switching it on
 * deliberately overrides whatever `registrationLink` still holds. The hint below
 * the switch says so, because an admin who left a Google Form in place last year
 * and ticks this box needs to understand that the form is now ignored — otherwise
 * they will find members filling in a form nobody reads.
 *
 * ⚠️ TIMEZONE. `datetime-local` yields a naive wall-clock string, and it is
 * interpreted here as Dhaka time via `utcIsoFromDhakaInput` — the same helper
 * `hackathon-content.jsx` uses.
 *
 * This is DELIBERATELY INCONSISTENT with the two date fields a few lines up in
 * `events-content.jsx`, which do `new Date(value).toISOString()` and therefore
 * interpret the typed wall-clock in the ADMIN'S BROWSER timezone. That form is
 * wrong — it is documented as a bug in `src/lib/dhaka-time.js` — and it is left
 * wrong on purpose: fixing it would re-interpret the stored instant of every
 * historical event, which is a far larger blast radius than this feature. The
 * participation deadlines have NO historical data, so they are written correctly
 * from the first commit rather than inheriting a bug that only affects documents
 * that already exist.
 *
 * ⚠️ BLANK DEADLINE MEANS "NO CUTOFF", NOT "CLEARED". The server treats an absent
 * `registrationDeadline` as an open window while `registrationEnabled` is true —
 * an intended state ("open until I turn it off"), not a missing value. So the
 * field is not required, and clearing it RE-OPENS the window rather than closing
 * it. That is the opposite of what clearing a date usually means, so it is called
 * out in the hint under the input.
 */
export function EventParticipationSettings({ formData, onChange }) {
    const registrationOn = formData.registrationEnabled === true;
    const submissionOn = formData.submissionEnabled === true;

    const teamMin = Number(formData.teamMinSize) || 1;
    const teamMax = Number(formData.teamMaxSize) || 5;

    // ⚠️ THE CLAMP WARNING IS SHOWN, NOT ENFORCED. The server clamps with
    // `Math.max(min, max)` and reports `team.clamped` so the UI can say so.
    // Silently rewriting the admin's numbers would make an inverted pair
    // indistinguishable from a deliberate one; refusing to save would make the
    // form refuse something the server accepts. Showing the resolved values is
    // the honest middle.
    const isInverted = teamMin > teamMax;
    const resolvedMax = Math.max(teamMin, teamMax);

    return (
        <div className="flex flex-col gap-6">
            {/* ── Registration ───────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                            <UserCheck className="size-4 text-header" />
                            In-app registration
                        </span>
                        <p className="text-xs text-muted-foreground">
                            Members register on this site, alone or as a team.
                        </p>
                    </div>
                    <Switch
                        checked={registrationOn}
                        onCheckedChange={(checked) => onChange({ registrationEnabled: checked })}
                        aria-label="Enable in-app registration"
                        className="shrink-0"
                    />
                </div>

                {registrationOn ? (
                    <>
                        <div className="flex items-start gap-2 rounded-lg bg-header/10 px-3 py-2">
                            <Info className="mt-0.5 size-4 shrink-0 text-header" />
                            <p className="text-xs text-foreground">
                                While this is on, the Register button on the event page goes
                                to <strong>this site&apos;s registration form</strong>. Any
                                external registration link saved on this event is ignored.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="event-registration-deadline">Registration closes</Label>
                            <Input
                                id="event-registration-deadline"
                                type="datetime-local"
                                value={toDhakaInputValue(formData.registrationDeadline)}
                                onChange={(e) => onChange({ registrationDeadline: utcIsoFromDhakaInput(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional. Leave blank to keep registration open until you
                                turn this switch off. A common choice is the event&apos;s own
                                start time.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="event-team-min">Minimum team size</Label>
                                <Input
                                    id="event-team-min"
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={formData.teamMinSize ?? ''}
                                    onChange={(e) => onChange({ teamMinSize: parseInt(e.target.value, 10) || 1 })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    1 allows solo entry. 2 or more makes a team mandatory — the
                                    form then offers no &quot;register alone&quot; option.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="event-team-max">Maximum team size</Label>
                                <Input
                                    id="event-team-max"
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={formData.teamMaxSize ?? ''}
                                    onChange={(e) => onChange({ teamMaxSize: parseInt(e.target.value, 10) || 5 })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Includes the captain. Capped at 50 by the server.
                                </p>
                            </div>
                        </div>

                        {isInverted ? (
                            <p
                                role="alert"
                                className="flex items-start gap-2 text-xs font-medium text-destructive"
                            >
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                <span>
                                    Minimum ({teamMin}) is above maximum ({teamMax}). The server
                                    will clamp this to a maximum of {resolvedMax} until you fix
                                    it.
                                </span>
                            </p>
                        ) : null}
                    </>
                ) : null}
            </div>

            {/* ── Submission ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Send className="size-4 text-header" />
                            In-app submissions
                        </span>
                        <p className="text-xs text-muted-foreground">
                            Registered participants file their project on this site — title,
                            description, repository link, demo link and technologies.
                        </p>
                    </div>
                    <Switch
                        checked={submissionOn}
                        onCheckedChange={(checked) => onChange({ submissionEnabled: checked })}
                        aria-label="Enable in-app submissions"
                        className="shrink-0"
                    />
                </div>

                {submissionOn ? (
                    <>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="event-submission-deadline">Submissions close</Label>
                            <Input
                                id="event-submission-deadline"
                                type="datetime-local"
                                value={toDhakaInputValue(formData.submissionDeadline)}
                                onChange={(e) => onChange({ submissionDeadline: utcIsoFromDhakaInput(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional, and INDEPENDENT of the registration deadline — which
                                is what lets registration shut at kickoff while submissions stay
                                open for days afterwards. Leave blank for no cutoff.
                            </p>
                        </div>

                        <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2">
                            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                                A participant may file exactly ONE submission, and it cannot be
                                withdrawn or replaced once submitted. Shortlisting an entry
                                publishes it on the event&apos;s winners list; a rejected one keeps
                                the review note the participant sees.
                            </p>
                        </div>
                    </>
                ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
                Both switches are off by default, so an event keeps whatever external
                form link it already has until you turn them on. Nothing here is
                inferred from the event dates — a deadline is the only thing that closes
                a window.
            </p>
        </div>
    );
}

/**
 * The empty shape for a NEW event.
 *
 * ⚠️ EXPLICIT `false` RATHER THAN OMITTING THE KEYS, and that is load-bearing.
 * `updateAdminContent` applies the request body as a `$set`, so an absent field is
 * UNSET — with a 200 and no error. For a create that would let Mongoose's schema
 * defaults apply, which happen to match; for the switch-off case below it would
 * mean a form that omitted a field silently cleared whatever was there.
 *
 * Sending the booleans explicitly is what makes "turn the switch off" persist.
 */
export const EMPTY_PARTICIPATION_FORM = {
    registrationEnabled: false,
    registrationDeadline: '',
    submissionEnabled: false,
    submissionDeadline: '',
    teamMinSize: 1,
    teamMaxSize: 5,
};

/**
 * Reads the six fields off an existing event into form state.
 *
 * `Boolean(...)` on the two switches rather than passing the raw value through:
 * the stored value may be `undefined` (a document written before these fields
 * existed) and `<Switch checked={undefined}>` renders as UNCONTROLLED, which makes
 * the toggle appear stuck. Coercing here means every switch has a definite value.
 */
export const participationFromEvent = (event) => ({
    registrationEnabled: event?.registrationEnabled === true,
    registrationDeadline: event?.registrationDeadline || '',
    submissionEnabled: event?.submissionEnabled === true,
    submissionDeadline: event?.submissionDeadline || '',
    teamMinSize: Number(event?.teamMinSize) || 1,
    teamMaxSize: Number(event?.teamMaxSize) || 5,
});

/**
 * The six fields as they go into a save payload.
 *
 * ⚠️ THE DEADLINES ARE SENT AS ISO STRINGS OR `null` — NEVER `''`. An empty
 * string cast to a `Date` is `Invalid Date`, which Mongoose would reject; and the
 * server's resolver treats a non-null, unparseable deadline as FAIL CLOSED, so an
 * accidental `''` would silently close the window rather than opening it. `null` is
 * the one value that means "no cutoff" on both sides.
 */
export const participationToPayload = (formData) => ({
    registrationEnabled: formData.registrationEnabled === true,
    registrationDeadline: formData.registrationDeadline || null,
    submissionEnabled: formData.submissionEnabled === true,
    submissionDeadline: formData.submissionDeadline || null,
    teamMinSize: Number(formData.teamMinSize) || 1,
    teamMaxSize: Number(formData.teamMaxSize) || 5,
});
