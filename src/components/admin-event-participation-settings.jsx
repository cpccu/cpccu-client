'use client';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Info, Send, UserCheck } from 'lucide-react';
import { ScheduleInstantField } from '@/components/event-schedule';
import {
  EVENT_SCHEDULE_FIELDS,
  FOLLOW_TOGGLE_FIELDS,
  PARTICIPATION_SWITCHES,
  readEventSchedule,
} from '@/lib/event-schedule';

/**
 * The twelve schedule fields, as a form section.
 *
 * Shared by `events-content.jsx` and `hackathon-content.jsx` because they are two
 * editors for the same `Event` document and these fields are NOT hackathon
 * specific. That is the whole design premise of the feature: the server's
 * `resolveEventParticipationWindow` reads them from any event object with no type
 * check at all, which is what lets a workshop, a lecture or a bootcamp use the
 * same registration flow a hackathon does.
 *
 * Two editors for one record is already a trap in this codebase — see the long
 * note in `events-content.jsx` about the two different date/timezone round trips.
 * A third copy of these fields would be a third place for them to drift, and the
 * drift would be silent: the fields are stored by `$set`, so a form that omits one
 * UNSETS it with a 200 and no error anywhere.
 *
 * ⚠️ THE TWELVE FIELDS ARE NEVER WRITTEN OUT BY HAND, AND THAT IS THE POINT.
 * `EMPTY_PARTICIPATION_FORM`, `participationFromEvent` and `participationToPayload`
 * are all built by iterating the three declarations in `@/lib/event-schedule`, so a
 * field cannot be added to the contract and forgotten in the payload. A hand-typed
 * list of twelve keys is a worse failure mode than a missing one: it would still
 * contain all twelve today and silently drop the thirteenth tomorrow, and the bug
 * would be "an admin's follow toggle disappeared on the next unrelated save", which
 * is indistinguishable from the admin not having set it.
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
 * ⚠️ TIMEZONE. The four window instants are written as Dhaka wall-clock by
 * `ScheduleInstantField`'s defaults (`utcIsoFromDhakaInput`). That is DELIBERATELY
 * INCONSISTENT with the two event instants a few lines up in `events-content.jsx`,
 * which do `new Date(value).toISOString()` and therefore interpret the typed
 * wall-clock in the ADMIN'S BROWSER timezone. That form is wrong — it is
 * documented as a bug in `src/lib/dhaka-time.js` — and it is left wrong on purpose:
 * fixing it would re-interpret the stored instant of every historical event, which
 * is a far larger blast radius than this feature. See `event-schedule.jsx` for why
 * the converters are a prop rather than a constant.
 *
 * The two are never mixed within one field, which is the only reason the
 * asymmetry is survivable: `events-content.jsx` passes the browser round trip to
 * its own two `ScheduleInstantField`s and the Dhaka default to these four.
 *
 * ⚠️ A BLANK INSTANT MEANS "NO CUTOFF", NOT "CLEARED". The server treats an absent
 * `registrationCloseAt` as an open window while `registrationEnabled` is true — an
 * intended state ("open until I turn it off"), not a missing value. So the fields
 * are not required, and clearing one RE-OPENS the window rather than closing it.
 * That is the opposite of what clearing a date usually means, so it is called out
 * in the hint under each input.
 *
 * ⚠️ THE TWO EVENT INSTANTS ARE CARRIED HERE BUT NOT EDITED HERE. They are part of
 * the twelve because a payload that omits one is UNSET by the server's `$set`, and
 * because the follow toggles are defined against them. But rendering a second pair
 * of date inputs for the same two fields would re-create the two-editors-one-record
 * trap this file exists to avoid — and worse, the two editors would disagree about
 * the encoding of the same key (wall-clock here, Dhaka ISO on the Basic tab).
 * `eventStartAt` / `eventEndAt` are therefore read and re-sent, never typed here.
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

    // The one toggle that governs a given instant, if any. Keyed by the TARGET
    // field because that is what the admin is looking at, and looked up rather
    // than hardcoded so the pairing lives in exactly one place — `@/lib/
    // event-schedule` — and cannot disagree with the server's write-time merge.
    const followFor = (targetField) =>
        FOLLOW_TOGGLE_FIELDS.find((entry) => entry.targetField === targetField);

    // ⚠️ LABELS COME FROM THE SHARED DECLARATION, NOT FROM A LOCAL CONSTANT. The
    // server's 400s name the fields (`registrationCloseAt` → "Registration must
    // close after it opens."), and a label that drifts from the field name is how
    // an admin ends up staring at "Registration closes" while the error talks
    // about `registrationCloseAt`. Only the two event instants are excluded,
    // because this section does not render them.
    const labelFor = (key) =>
        EVENT_SCHEDULE_FIELDS.find((field) => field.key === key)?.label ?? key;

    const windowField = (key, id, hint) => {
        const follow = followFor(key);

        return (
            <ScheduleInstantField
                key={key}
                id={id}
                label={labelFor(key)}
                value={formData[key]}
                hint={hint}
                followsChecked={follow ? formData[follow.toggleField] === true : undefined}
                onFollowsChange={
                    follow ? (checked) => onChange({ [follow.toggleField]: checked }) : undefined
                }
                followLabel={follow?.label}
            />
        );
    };

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

                        {/* ⚠️ OPEN AND CLOSE ARE SEPARATE FIELDS, NOT ONE CUTOFF.
                            A window that opens next week and closes at kickoff is the
                            ordinary case for a hackathon, and a single "deadline"
                            could not describe it — which is also why the closing
                            instant is what a member who arrives late is told, and the
                            opening instant is what a member who arrives early is
                            told. Rendering only the close here would leave the open
                            column unsettable. */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {windowField(
                                'registrationOpenAt',
                                'event-registration-opens',
                                'Optional. Leave blank to open registration as soon as you switch this on.'
                            )}
                            {windowField(
                                'registrationCloseAt',
                                'event-registration-closes',
                                'Optional. Leave blank to keep registration open until you turn this switch off.'
                            )}
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
                        {/* ⚠️ INDEPENDENT OF THE REGISTRATION WINDOW ON BOTH SIDES.
                            The submission close anchors on the event END while the
                            registration close anchors on the event START, and that is
                            the whole point of the feature: registration shuts at
                            kickoff while submissions stay open for days afterwards.
                            Anchoring both on the event start would make a hackathon
                            whose submissions run to the closing ceremony impossible to
                            configure. */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {windowField(
                                'submissionOpenAt',
                                'event-submission-opens',
                                'Optional. Leave blank to accept submissions from the moment you switch this on.'
                            )}
                            {windowField(
                                'submissionCloseAt',
                                'event-submission-closes',
                                'Optional, and independent of the registration window. Leave blank for no cutoff.'
                            )}
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
                inferred from the event dates unless you tick a &quot;same as&quot; box
                and ask for it.
            </p>
        </div>
    );
}

/**
 * Turns one of `@/lib/event-schedule`'s declarations into a form / payload object.
 *
 * ⚠️ THE THREE LISTS DECLARE THEIR KEY UNDER DIFFERENT NAMES ON PURPOSE —
 * `EVENT_SCHEDULE_FIELDS` and `PARTICIPATION_SWITCHES` hold the field name as
 * `key`, while `FOLLOW_TOGGLE_FIELDS` holds it as `toggleField` because each entry
 * also carries a `targetField` and calling both of them `key` would be a bug
 * waiting to happen. Hence the selector argument rather than a shared shape.
 */
const byKeys = (declarations, keyOf, valueOf) =>
    Object.fromEntries(declarations.map((declaration) => [keyOf(declaration), valueOf(declaration)]));

/**
 * The empty shape for a NEW event.
 *
 * ⚠️ EXPLICIT `false` AND EXPLICIT `''` RATHER THAN OMITTING THE KEYS, and that is
 * load-bearing. `updateAdminContent` applies the request body as a `$set`, so an
 * absent field is UNSET — with a 200 and no error. For a create that would let
 * Mongoose's schema defaults apply, which happen to match; for the switch-off case
 * below it would mean a form that omitted a field silently cleared whatever was
 * there.
 *
 * Sending the booleans explicitly is what makes "turn the switch off" persist.
 *
 * The instants are `''` rather than `null` because this is FORM STATE, and an empty
 * `<input>` cannot hold `null`; `participationToPayload` is what turns `''` back
 * into the `null` the API wants.
 */
export const EMPTY_PARTICIPATION_FORM = {
    ...byKeys(EVENT_SCHEDULE_FIELDS, (field) => field.key, () => ''),
    ...byKeys(FOLLOW_TOGGLE_FIELDS, (entry) => entry.toggleField, () => false),
    ...byKeys(PARTICIPATION_SWITCHES, (entry) => entry.key, () => false),
    teamMinSize: 1,
    teamMaxSize: 5,
};

/**
 * Reads the twelve fields off an existing event into form state.
 *
 * `readEventSchedule` is the reader, and it coerces the four toggles and two
 * switches with `=== true` rather than passing the raw value through: the stored
 * value may be `undefined` (a document written before these fields existed) and
 * `<Switch checked={undefined}>` / an unticked `Checkbox` from an `undefined`
 * `checked` renders as UNCONTROLLED, which makes the toggle appear stuck.
 * Coercing here means every control has a definite value.
 */
export const participationFromEvent = (event) => ({
    ...readEventSchedule(event),
    teamMinSize: Number(event?.teamMinSize) || 1,
    teamMaxSize: Number(event?.teamMaxSize) || 5,
});

/**
 * The twelve fields as they go into a save payload.
 *
 * ⚠️ THE INSTANTS ARE SENT AS ISO STRINGS OR `null` — NEVER `''`. An empty string
 * cast to a `Date` is `Invalid Date`, which Mongoose would reject; and the server's
 * resolver treats a non-null, unparseable instant as FAIL CLOSED, so an accidental
 * `''` would silently close the window rather than opening it. `null` is the one
 * value that means "no cutoff" on both sides.
 *
 * ⚠️ AND A TICKED FOLLOW TOGGLE CLEARS ITS TARGET INSTANT. The server overwrites
 * the target from the anchor whenever the toggle is true, so anything still sitting
 * in the form is stale the moment it is sent. `ScheduleInstantField` already clears
 * it when the box is ticked; repeating it here means the guarantee does not depend
 * on which control drove the toggle — and this is the right place for it, because
 * this function is the single choke point every editor's `$set` payload goes through.
 */
export const participationToPayload = (formData) => {
    const payload = {
        ...byKeys(EVENT_SCHEDULE_FIELDS, (field) => field.key, (field) => formData[field.key] || null),
        ...byKeys(FOLLOW_TOGGLE_FIELDS, (entry) => entry.toggleField, (entry) => formData[entry.toggleField] === true),
        ...byKeys(PARTICIPATION_SWITCHES, (entry) => entry.key, (entry) => formData[entry.key] === true),
        teamMinSize: Number(formData.teamMinSize) || 1,
        teamMaxSize: Number(formData.teamMaxSize) || 5,
    };

    for (const { toggleField, targetField } of FOLLOW_TOGGLE_FIELDS) {
        if (formData[toggleField] === true) {
            payload[targetField] = null;
        }
    }

    return payload;
};