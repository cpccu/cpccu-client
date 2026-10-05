"use client";

import { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { Search, UserPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSearchMembersQuery } from "@/features/participation/participationApi";
import { getParticipationErrorMessage } from "@/lib/participation";

/**
 * Co-member picker for an event registration.
 *
 * LETS A CAPTAIN BUILD A TEAM BY SEARCHING APPROVED MEMBERS, rather than by
 * typing student IDs blind.
 *
 * Props:
 *   members      — the chosen teammates: `{ _id, fullName, uniID, avatar }`
 *   onChange     — called with the full next array. The component never mutates
 *                  `members`; the parent owns it, because the parent is what
 *                  decides the shape of the submission body.
 *   maxCount     — how many MORE members may be added. The caller subtracts the
 *                  owner, because the owner counts toward the server's team
 *                  ceiling and it is very easy to forget.
 *
 * WHAT THE SERVER DOES AND DOES NOT DO HERE
 * -----------------------------------------
 * The server is the gate, not this component. It re-resolves every `uniID`, and
 * it refuses the whole request if ANY chosen member is unknown or not approved.
 * That means this picker can be wrong in the member's favour — it may show
 * someone who has since been un-approved, and the submit will 400 naming them —
 * but it can never be wrong in a way that writes bad data. The 400 is the
 * backstop, not a second implementation of the rule.
 *
 * ⚠️ THE SEARCH IS DEBOUNCED, AND THE DEBOUNCE IS NOT AN OPTIMISATION.
 * The server's per-user ceiling for this endpoint is 60 per 15 minutes — sized for
 * a debounced type-ahead, not one request per keystroke. `MemberPicker` holds the
 * term in local state, waits 300ms after it stops changing, and only THEN promotes
 * it to `termArg`, which is the value the query actually runs on.
 *
 * ⚠️ `termArg` STARTS AS `skipToken`, NOT `''`. Passing `''` would issue a real
 * request on mount, and the server answers anything under two characters with a
 * 400 — so the first thing a member would see is a request that could not have
 * succeeded. `skipToken` means the query does not exist at all until there is
 * something worth asking.
 *
 * ⚠️ RESULTS ALREADY CHOSEN ARE FILTERED OUT CLIENT-SIDE, not by the server. The
 * endpoint is NOT scoped to the event, so it does not know what is in this draft
 * team — and duplicating that filter server-side would mean two implementations
 * of "who is already on this team" free to disagree. Hiding a chosen row is a
 * courtesy; the server still rejects a genuine duplicate.
 */
const SEARCH_DEBOUNCE_MS = 300;

/** The server's floor. Mirrored so the UI can hint before a request is wasted. */
const MIN_QUERY_LENGTH = 2;

export default function MemberPicker({ members, onChange, maxCount }) {
  const [term, setTerm] = useState("");
  // The debounced value the query runs on. `skipToken` until it is worth asking.
  const [termArg, setTermArg] = useState(skipToken);

  const {
    data,
    isFetching,
    error,
  } = useSearchMembersQuery(termArg);

  const chosenIds = useMemo(
    () => new Set((members || []).map((member) => String(member._id))),
    [members]
  );

  const chosenUniIds = useMemo(
    () =>
      new Set(
        (members || [])
          .map((member) => String(member.uniID || "").toLowerCase())
          .filter(Boolean)
      ),
    [members]
  );

  const isFull = (members || []).length >= maxCount;

  // ⚠️ ONE EFFECT, TWO JOBS: debounce, and decide whether there is a query at all.
  useEffect(() => {
    const trimmed = term.trim();

    // Below the floor: retract the query. Firing anyway would spend a request to
    // be told 400, and this endpoint's budget is per-user.
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setTermArg(skipToken);
      return undefined;
    }

    const timer = setTimeout(() => setTermArg(trimmed), SEARCH_DEBOUNCE_MS);

    // Clearing on every keystroke is what makes this a DEBOUNCE rather than a
    // throttle: without the cleanup, each keystroke would schedule its own timer
    // and all of them would fire, producing exactly one request per character.
    return () => clearTimeout(timer);
  }, [term]);

  const visibleResults = useMemo(() => {
    const rows = Array.isArray(data?.data) ? data.data : [];

    return rows.filter(
      (row) =>
        !chosenIds.has(String(row?._id)) &&
        !chosenUniIds.has(String(row?.uniID || "").toLowerCase())
    );
  }, [data, chosenIds, chosenUniIds]);

  const searchError = getParticipationErrorMessage(
    error,
    "Could not search members. Please try again."
  );

  const isSearchable = term.trim().length >= MIN_QUERY_LENGTH;

  const addMember = (row) => {
    if (isFull) return;
    onChange([...(members || []), row]);
    // Clearing the term is what makes the picker usable for the common case of
    // adding several people in a row — otherwise the previous name's results sit
    // under the box while you type the next one.
    setTerm("");
  };

  const removeMember = (member) => {
    onChange((members || []).filter((entry) => entry._id !== member._id));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── The chosen team ────────────────────────────────────────────────── */}
      {members?.length ? (
        <ul className="flex flex-wrap gap-2">
          {members.map((member) => (
            <li key={member._id}>
              <span className="inline-flex items-center gap-2 rounded-full bg-header/10 py-1 pl-3 pr-1 text-sm font-medium text-header">
                <span className="max-w-[12rem] truncate">
                  {member.fullName || member.uniID}
                </span>
                <button
                  type="button"
                  onClick={() => removeMember(member)}
                  className="inline-flex size-6 items-center justify-center rounded-full text-header/70 transition-colors hover:bg-header/20 hover:text-header"
                  aria-label={`Remove ${member.fullName || member.uniID} from the team`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── The search box ─────────────────────────────────────────────────── */}
      {/* ⚠️ NOT RENDERED AT ALL WHEN THE TEAM IS FULL. Showing an active-looking
          search box that then rejects every click reads as a broken control; a
          member at the ceiling needs to see the reason, which is below. */}
      {isFull ? (
        <p className="text-sm text-muted-foreground">
          This event allows at most {maxCount} participants per registration,
          including you. Remove someone to swap them out.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="member-search"
            className="text-sm font-semibold text-foreground"
          >
            Add teammates
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="member-search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search by name, student ID or email"
              autoComplete="off"
              className="pl-9"
              aria-describedby="member-search-hint"
            />
          </div>
          <p id="member-search-hint" className="text-xs text-muted-foreground">
            Only approved CPCCU members can be added. You can still add{" "}
            {maxCount - (members?.length || 0) - 1} more.
          </p>

          {/* The server 400s below two characters; saying so is cheaper than
              letting someone find out by watching a request fail. */}
          {term.trim().length > 0 && !isSearchable ? (
            <p className="text-sm text-muted-foreground">
              Enter at least {MIN_QUERY_LENGTH} characters to search.
            </p>
          ) : null}

          {searchError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {searchError}
            </p>
          ) : null}

          {isFetching ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : null}

          {/* ⚠️ THE EMPTY-STATE GUARD IS `isSearchable && !isFetching && !error`,
              NOT `visibleResults.length === 0`. Without the other three, RTK
              Query's first render for a brand-new argument has `data === undefined`
              — so a member who has just stopped typing would be told "no approved
              members matched" before the request has even returned. That is the
              classic debounce bug, and it looks like a broken search rather than a
              slow one. */}
          {isSearchable && !isFetching && !error ? (
            visibleResults.length ? (
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                {visibleResults.map((row) => (
                  <li key={row._id}>
                    <button
                      type="button"
                      onClick={() => addMember(row)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-responsibility"
                    >
                      <UserPlus
                        className="size-4 shrink-0 text-header"
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {row.fullName || "Unnamed member"}
                        </span>
                        {row.uniID ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {row.uniID}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No approved members matched “{term.trim()}”. Check the spelling, or
                search by student ID.
              </p>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}