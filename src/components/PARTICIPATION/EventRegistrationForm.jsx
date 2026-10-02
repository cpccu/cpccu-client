"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Loader2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MemberPicker from "@/components/PARTICIPATION/MemberPicker";
import { useCreateEventRegistrationMutation } from "@/features/participation/participationApi";
import {
  ACTION_STATES,
  getParticipationErrorMessage,
  normalizeTeamName,
  resolveTeamRules,
  resolveWindowAction,
} from "@/lib/participation";
import { formatDhakaDateTime } from "@/lib/dhaka-time";

/**
 * Create a registration for one event — solo, or as a team.
 *
 * Props:
 *   eventId    — from the route. It goes in the PATH on create; see the rule at the
 *                top of `participationApi.js` about never sending it in a body.
 *   window     — the participation window (`data` from the window endpoint)
 *   eventTitle — used only in the success copy.
 *   onRegistered — optional. Called with the created registration. When absent the
 *                  component navigates to the submit page itself; the detail page
 *                  supplies a callback so it can stay put.
 *
 * ⚠️ THE FORM'S SHAPE IS DERIVED, NOT CHOSEN. `resolveTeamRules(window)` returns
 * `solo` | `team` | `either`, and each one is a materially different form:
 *
 *   solo   — one participant, NO name field (the server names it after the member)
 *   team   — name + picker REQUIRED, no "alone" option at all
 *   either — starts as solo, name + picker appear the moment a teammate is added
 *
 * The `team` case is the one worth defending. When `teamMinSize >= 2` the server
 * refuses a solo registration with a 400. A form that offers "register alone" and
 * then fails on submit teaches the member that the form is broken, when in fact
 * the form is contradicting the event's rules.
 *
 * ⚠️ `memberIds` IS SENT AS `uniID` STRINGS, AND ONLY FOR THE CHOSEN MEMBERS. The
 * picker collects user documents; the wire format is student IDs, which the server
 * resolves case-insensitively. Sending `_id`s would 400 with "No member found for
 * student ID: …" naming ids that look like ObjectIds — a confusing error for a
 * completely correct submission.
 *
 * ⚠️ EVERY SERVER ERROR IS RENDERED VERBATIM. There are no machine-readable codes
 * in this API, and the messages were written for participants ("That name is
 * already taken for this event.", "These members are not approved to take part in
 * events: 22109999."). Re-deriving them here would mean maintaining a second copy
 * of every rule's wording. See `getParticipationErrorMessage`.
 */
export default function EventRegistrationForm({
  eventId,
  window,
  eventTitle,
  onRegistered,
}) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState([]);
  const [formError, setFormError] = useState("");
  const [createRegistration, { isLoading }] =
    useCreateEventRegistrationMutation();

  const teamRules = useMemo(() => resolveTeamRules(window), [window]);
  const registration = resolveWindowAction(window, 'registration');

  const isTeam = teamRules.mode === 'team' || members.length > 0;

  // ── Client-side guards ────────────────────────────────────────────────────
  // Every one of these is a FAST FEEDBACK duplicate of a server check, never a
  // replacement for one. Blocking a submission here that the server would have
  // accepted is the only way this layer can be wrong, and that direction is
  // chosen deliberately: a form that refuses too eagerly costs one confused
  // member, while a form that submits too eagerly costs a 400 they cannot act on.
  const validate = () => {
    if (members.length + 1 > teamRules.max) {
      return `This event allows at most ${teamRules.max} participants per registration, including you.`;
    }

    if (isTeam) {
      if (!normalizeTeamName(teamName)) {
        return teamRules.mode === 'team'
          ? 'A team name is required for this event.'
          : 'Give your team a name, or remove your teammates to register alone.';
      }
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }

    try {
      const response = await createRegistration({
        eventId,
        // ⚠️ `name` is sent ONLY for a team. For a solo the server ignores it
        // entirely and names the registration after the member, so sending it
        // would be a claim about the stored value that is not true.
        ...(isTeam ? { name: normalizeTeamName(teamName) } : {}),
        // ⚠️ OMITTED, not `[]`, for a solo. The two are equivalent to the server
        // but omitting it keeps the request honest about what is being asked.
        ...(isTeam
          ? { memberIds: members.map((member) => member.uniID).filter(Boolean) }
          : {}),
      }).unwrap();

      if (onRegistered) {
        onRegistered(response?.data);
        return;
      }

      // Straight to the submission step. `replace` rather than `push` so the
      // Back button does not return to a form that has already been submitted —
      // which would re-render a filled-in create form whose submission now 409s
      // with "already registered", a genuinely baffling dead end.
      router.replace(`/event/${eventId}/submit`);
    } catch (error) {
      setFormError(
        getParticipationErrorMessage(
          error,
          'Could not complete your registration. Please try again.'
        )
      );
    }
  };

  if (registration.state === ACTION_STATES.CLOSED) {
    return (
      <ClosedNotice
        title="Registration is closed"
        detail={
          registration.deadline
            ? `Registration for ${eventTitle} closed on ${formatDhakaDateTime(registration.deadline)}.`
            : `Registration for ${eventTitle} is not open.`
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">
          Register for {eventTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {teamRules.mode === 'solo'
            ? 'This event is for individual participants.'
            : teamRules.mode === 'team'
              ? `Teams of ${teamRules.min} to ${teamRules.max} participants. You are the captain.`
              : `Register alone, or add teammates for a team of up to ${teamRules.max}.`}
        </p>
      </div>

      {/* ── The member's own row ─────────────────────────────────────────────
          Always shown, even though it is not editable: it confirms who the
          registration will be under, and it makes the team-size maths visible
          (the owner counts toward the ceiling, which is the single most common
          off-by-one in this form). */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-responsibility px-5 py-4">
        <UserRound className="size-5 shrink-0 text-header" aria-hidden="true" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground">
            You (captain)
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {teamRules.mode === 'solo'
              ? 'Your registration will be named after you.'
              : 'You are added automatically — you do not need to search for yourself.'}
          </span>
        </div>
      </div>

      {/* ── Team section ─────────────────────────────────────────────────── */}
      {teamRules.mode !== 'solo' ? (
        <div className="flex flex-col gap-4">
          {isTeam ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="team-name">Team name</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Team Phoenix"
                  // ⚠️ 80 is the server's `MAX_TEAM_NAME_LENGTH`. Setting it on
                  // the input as well means the member is never told "too long"
                  // for something the field physically let them type. The two must
                  // match; they are the same rule expressed twice, and the input is
                  // the friendlier of the two.
                  maxLength={80}
                  required={isTeam}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="size-4 text-header" aria-hidden="true" />
                  Team members
                </span>
                <MemberPicker
                  members={members}
                  onChange={setMembers}
                  // ⚠️ THE OWNER COUNTS. `max` is a total, the picker takes a
                  // count of how many MORE may be added, so the owner's seat is
                  // reserved here rather than discovered as an off-by-one 400 on
                  // submit.
                  maxCount={teamRules.max}
                />
              </div>

              {/* ── The "register alone after all" escape hatch ─────────────
                  Only offered in `either` mode. In `team` mode this control is
                  absent entirely: the server would reject the result, so offering
                  it would be offering a failure. */}
              {teamRules.mode === 'either' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMembers([]);
                    setTeamName('');
                  }}
                  className="self-start text-sm font-medium text-header underline underline-offset-4 hover:text-header-hover"
                >
                  Register alone instead
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add at least {teamRules.min - 1} teammate
              {teamRules.min - 1 === 1 ? '' : 's'} to form a team.
            </p>
          )}
        </div>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm font-medium text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="break-words">{formError}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isLoading}
          className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 md:min-h-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Registering…
            </>
          ) : (
            <>
              <Check className="size-4" aria-hidden="true" />
              Complete registration
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Next you will be taken to the project submission step.
          <ArrowRight className="ml-1 inline size-3" aria-hidden="true" />
        </p>
      </div>
    </form>
  );
}

/**
 * The "this action is not available" panel.
 *
 * ⚠️ SHARED BY THE REGISTRATION AND SUBMISSION FORMS rather than duplicated, so
 * the wording for a closed window cannot differ between the two screens a member
 * moves between — the mismatch ("registration is closed" on one page, "closed for
 * submissions" on the next, for the same event) is exactly what makes a feature
 * feel unmaintained.
 *
 * It renders a `<div role="status">` rather than an error: nothing failed, the
 * window is simply shut. Using the error treatment here trains members to ignore
 * red panels, which is what hides the real ones.
 */
export function ClosedNotice({ title, detail }) {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card px-6 py-6"
    >
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="break-words text-muted-foreground">{detail}</p>
    </div>
  );
}