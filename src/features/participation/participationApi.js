import { baseApi } from '@/services/baseApi';

/**
 * RTK Query bindings for event participation — `/api/v1/participation`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ READ THIS BEFORE ADDING AN ENDPOINT — four rules that are not negotiable
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── 1. `eventId` GOES IN THE PATH ON A CREATE, AND NOWHERE ELSE ──────────────
 *
 * `POST /participation/events/:eventId/registrations` takes the id from the
 * route, because on a create there is no registration document yet for it to be
 * derived from. Every OTHER route addresses a registration by its OWN id alone
 * (`/registrations/:registrationId`), because that document already states its
 * `eventId`. There is deliberately no `/events/:eventId/registrations/:id` shape:
 * two caller-supplied copies of one fact is exactly how they drift, and the
 * server documents this at length.
 *
 * ⚠️ NEVER SEND `eventId` IN A REQUEST BODY. `EventSubmission.eventId` is
 * derived server-side from the registration; a body copy is ignored on reads and
 * silently wrong on writes. Treat one as a bug, not as input to reconcile.
 *
 * ── 2. NO `FORMDATA`, EVER ───────────────────────────────────────────────────
 *
 * Every participation route is JSON. `prepareHeaders` in `baseApi.js` sets
 * `Content-Type: application/json` for every endpoint except the two image
 * uploads, and the server has no multer on this router. A `FormData` body here
 * would arrive with no parsed fields and the controller would read `req.body` as
 * `{}` — producing a confusing 400 ("a team name is required") for what is
 * really a malformed request.
 *
 * ── 3. RESPONSES ARE `ApiResponse` — UNWRAP WITH `data.data` ────────────────
 *
 * `{ statusCode, data, message, success }` on success, `{ status, message,
 * errors }` on failure. Read `error?.data?.message`, and note that there are NO
 * machine-readable error codes anywhere in this API: the messages are written for
 * participants and should be rendered verbatim. See `getParticipationErrorMessage`
 * in `@/lib/participation.js`.
 *
 * ── 4. 404 IS THE ANSWER FOR "NOT YOURS" ────────────────────────────────────
 *
 * A registration the caller may not see is 404, never 403 — a 403 confirms the
 * id exists and turns the endpoint into an existence oracle. Do not write UI
 * that expects a 403 here; the absence of a distinction is the design.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TAG ID SCHEME
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * All under the `Participation` type. Composite ids, because the screens that
 * read these endpoints read several of them at once and a flat tag would evict
 * unrelated data on every write:
 *
 *   `window:<eventId>`       public, anonymous, contains NO participant data
 *   `winners:<eventId>`      public, anonymous, shortlist only
 *   `mine`                   private — the member's own registrations
 *   `reg:<registrationId>`   private — one registration with its submission
 *   `submission:<registrationId>` private — the submission alone
 *   `search`                 private — the co-member picker
 *   `admin:<eventId>:<kind>` admin review lists
 *
 * ⚠️ `window:` IS NOT INVALIDATED BY ANY MEMBER WRITE, and that is intentional
 * rather than an oversight. The window is derived from the Event document, which
 * only an ADMIN changes. A member registering does not make the window any more
 * or less open, so evicting it would refetch a page whose content cannot have
 * changed. The admin review mutation DOES invalidate it, because shortlisting a
 * submission changes what `winners:` serves.
 */

export const participationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Public ────────────────────────────────────────────────────────────────

    /**
     * `GET /participation/events/:eventId` — the window a member is about to act
     * on. ANONYMOUS, and it carries no participant data by design: it answers
     * "can I register, until when, and how big may my team be", all of which the
     * event's own public listing already implies.
     */
    getEventParticipationWindow: builder.query({
      query: (eventId) => `/participation/events/${eventId}`,
      providesTags: (result, error, eventId) => [
        { type: 'Participation', id: `window:${eventId}` },
      ],
    }),

    /**
     * `GET /participation/events/:eventId/winners` — the published shortlist.
     *
     * ⚠️ The projection is deliberately tiny and has NO `_id`:
     * `{ title, liveUrl, technologies, registrationName, kind }`. There is no
     * `repoUrl`, no member names, no student IDs, and nothing enumerable. An
     * empty array with a 200 is a NORMAL state, not an error — every un-reviewed
     * event looks exactly like this.
     *
     * A solo finalist's real full name IS published, as `registrationName`. That
     * is a deliberate disclosure: a solo entry has no team name to display, and
     * publishing winners anonymously would be worse. It is worth knowing before
     * anyone assumes the endpoint leaks contact details.
     */
    getEventWinners: builder.query({
      query: (eventId) => `/participation/events/${eventId}/winners`,
      providesTags: (result, error, eventId) => [
        { type: 'Participation', id: `winners:${eventId}` },
      ],
    }),

    // ── Member ────────────────────────────────────────────────────────────────

    /**
     * `GET /participation/me/registrations` — the member's own registrations,
     * newest first, INCLUDING withdrawn ones.
     *
     * ⚠️ `eventId` is an OPTIONAL query filter and the server does NOT validate
     * it: a malformed value is silently ignored and the full list comes back with
     * a 200. So a filter that "did not apply" is not an error condition and must
     * not be rendered as one — the UI filters client-side too
     * (`findActiveRegistration`).
     *
     * Each row carries its `submission` inline, which is what makes this one
     * request enough to drive the whole "your participation" surface — no N+1
     * round trips between the registration list and the submission state.
     */
    getMyRegistrations: builder.query({
      query: (eventId) => ({
        url: '/participation/me/registrations',
        params: eventId ? { eventId } : undefined,
      }),
      providesTags: [{ type: 'Participation', id: 'mine' }],
    }),

    /** `GET /participation/registrations/:registrationId` — one, with its submission. */
    getRegistration: builder.query({
      query: (registrationId) => `/participation/registrations/${registrationId}`,
      providesTags: (result, error, registrationId) => [
        { type: 'Participation', id: 'mine' },
        { type: 'Participation', id: `reg:${registrationId}` },
      ],
    }),

    /**
     * `POST /participation/events/:eventId/registrations` — create.
     *
     * Body is `{ name?, memberIds? }` and NOTHING ELSE.
     *
     *   * `memberIds` absent/empty → a SOLO registration, and `name` is IGNORED —
     *     the server names it after `req.user.fullName`. Sending a name for a solo
     *     is not an error but it is a lie about what will be stored.
     *   * `memberIds` non-empty → a team, and `name` is REQUIRED.
     *
     * ⚠️ THE RESPONSE'S `members` HAVE EMPTY `fullName`/`uniID`/`avatar`. The
     * create path does not `populate`, so the roster in the 201 body is empty
     * strings. Anything that renders member names must re-fetch via
     * `getRegistration` or read `getMyRegistrations`, both of which populate.
     * This is the single most likely source of "my team shows up as blanks".
     *
     * `memberIds` are `uniID` values — resolved case-insensitively, and every one
     * must belong to an APPROVED member or the whole request 400s naming them.
     */
    createEventRegistration: builder.mutation({
      query: ({ eventId, name, memberIds }) => ({
        url: `/participation/events/${eventId}/registrations`,
        method: 'POST',
        body: {
          // Omitted rather than sent empty when solo: the server treats `[]` and
          // `undefined` identically, but omitting it keeps the request honest
          // about what is being asked for.
          ...(name ? { name } : {}),
          ...(memberIds && memberIds.length ? { memberIds } : {}),
        },
      }),
      invalidatesTags: [{ type: 'Participation', id: 'mine' }],
    }),

    /**
     * `PATCH /participation/registrations/:registrationId` — owner only.
     *
     * ⚠️ THE THREE SHAPES OF `memberIds` ARE THREE DIFFERENT REQUESTS, and
     * collapsing them is the bug this note exists to prevent:
     *
     *   omitted  → leave the team exactly as it is
     *   `[]`     → drop everyone but me (turn a team into a solo)
     *   `[a, b]` → replace the roster entirely
     *
     * Omitting the key to mean "no change" is right. Sending `[]` to mean "no
     * change" would silently dissolve a team.
     *
     * A SOLO CANNOT BE RENAMED — the server 400s if `name` is sent while the
     * resulting count is 1, with copy saying to add a member first. And a team
     * that grows from a solo must be NAMED in the same request.
     */
    updateRegistration: builder.mutation({
      query: ({ registrationId, name, memberIds }) => ({
        url: `/participation/registrations/${registrationId}`,
        method: 'PATCH',
        body: {
          ...(name !== undefined ? { name } : {}),
          ...(memberIds !== undefined ? { memberIds } : {}),
        },
      }),
      invalidatesTags: [
        { type: 'Participation', id: 'mine' },
        // The per-registration entry is keyed by an id the caller already holds,
        // so it can be evicted precisely — this is what stops the submit page
        // showing a stale team size after an edit on the register page.
        { type: 'Participation', id: (result, error, arg) => `reg:${arg.registrationId}` },
      ],
    }),

    /**
     * `DELETE /participation/registrations/:registrationId` — withdraw. Owner only.
     *
     * ⚠️ WITHDRAWING IS A TOMBSTONE, NOT A DELETE, AND IT IS NOT ALWAYS ALLOWED.
     * The document survives with `status: 'withdrawn'`; the partial unique index
     * is keyed on `status: 'registered'`, so withdrawing FREES the member to
     * register again (which is intended), but it also means the row is gone from
     * the "who is in this event" view.
     *
     * A registration that has a submission cannot be withdrawn — the server 409s
     * with "Contact an administrator". That is a genuine dead end for the member
     * by design, so the UI must not offer the button in that state; offering one
     * that always fails is worse than not offering it.
     *
     * The response's members are NOT populated, for the same reason the create
     * response's are not.
     */
    withdrawRegistration: builder.mutation({
      query: (registrationId) => ({
        url: `/participation/registrations/${registrationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'Participation', id: 'mine' },
        { type: 'Participation', id: (result, error, arg) => `reg:${arg}` },
      ],
    }),

    /**
     * `GET /participation/registrations/:registrationId/submission`
     *
     * ⚠️ 404 — `No submission has been filed for this registration.` — is the
     * NORMAL first-visit answer, not a failure. A screen that treats it as an
     * error will show a red banner to every participant who has simply not
     * submitted yet.
     *
     * Readable by ANY member of the registration, not only the owner. Writes are
     * owner-only. That asymmetry is why the submit page must gate its EDIT
     * affordances on `isOwner`, not merely on the fetch succeeding.
     */
    getSubmission: builder.query({
      query: (registrationId) =>
        `/participation/registrations/${registrationId}/submission`,
      providesTags: (result, error, registrationId) => [
        { type: 'Participation', id: `submission:${registrationId}` },
        { type: 'Participation', id: `reg:${registrationId}` },
      ],
    }),

    /**
     * `POST /participation/registrations/:registrationId/submission` — file one.
     *
     * Body is `{ title, description?, repoUrl?, liveUrl?, technologies? }`.
     *
     * ⚠️ THERE IS EXACTLY ONE SUBMISSION PER REGISTRATION, EVER. `registrationId`
     * carries a UNIQUE index, so a second POST is a permanent 409 — there is no
     * member-facing replace, no delete, and no resubmit. A rejected entry is
     * final, and `reviewNote` is the only feedback the participant ever receives.
     * UI must not imply otherwise: no "resubmit" affordance may exist.
     *
     * `repoUrl` and `liveUrl` go through the server's URL policy (http/https
     * only, ≤2048 chars, no credentials, not protocol-relative). There is NO file
     * upload and NO video field — a demo video is a link pasted into `liveUrl`.
     */
    createSubmission: builder.mutation({
      query: ({ registrationId, title, description, repoUrl, liveUrl, technologies }) => ({
        url: `/participation/registrations/${registrationId}/submission`,
        method: 'POST',
        body: {
          title,
          ...(description ? { description } : {}),
          ...(repoUrl ? { repoUrl } : {}),
          ...(liveUrl ? { liveUrl } : {}),
          ...(technologies?.length ? { technologies } : {}),
        },
      }),
      invalidatesTags: [
        { type: 'Participation', id: 'mine' },
        { type: 'Participation', id: (result, error, arg) => `submission:${arg.registrationId}` },
        { type: 'Participation', id: (result, error, arg) => `reg:${arg.registrationId}` },
      ],
    }),

    /**
     * `PATCH /participation/registrations/:registrationId/submission` — edit.
     *
     * ⚠️ ONLY WHILE `status === 'submitted'`. Once shortlisted or rejected the
     * server 409s and the entry is permanently un-editable. The form disables
     * itself via `isSubmissionEditable` rather than letting someone fill it in and
     * be refused.
     *
     * A PATCH with no recognised field is a 400 (`No editable fields were
     * supplied.`), so an unchanged form must not be submitted.
     */
    updateSubmission: builder.mutation({
      query: ({ registrationId, title, description, repoUrl, liveUrl, technologies }) => ({
        url: `/participation/registrations/${registrationId}/submission`,
        method: 'PATCH',
        body: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(repoUrl !== undefined ? { repoUrl } : {}),
          ...(liveUrl !== undefined ? { liveUrl } : {}),
          ...(technologies !== undefined ? { technologies } : {}),
        },
      }),
      invalidatesTags: [
        { type: 'Participation', id: 'mine' },
        { type: 'Participation', id: (result, error, arg) => `submission:${arg.registrationId}` },
        { type: 'Participation', id: (result, error, arg) => `reg:${arg.registrationId}` },
      ],
    }),

    /**
     * `GET /participation/member-search?q=` — the co-member picker.
     *
     * ⚠️ THIS IS A PLAIN `query` DRIVEN BY `skipToken`, NOT A DEDICATED LAZY
     * ENDPOINT, and the reason is worth recording because the obvious
     * implementation is wrong in a way that is invisible until it misbehaves.
     *
     * As an ordinary query that fires whenever the hook is called with a real
     * argument, it would run on mount with whatever `q` happened to be — including
     * `''`, which the server rejects with a 400. A type-ahead that 400s before the
     * member has typed anything is a guaranteed first impression, and it would also
     * burn the endpoint's per-user budget on a request that could never succeed.
     *
     * `skipToken` solves it without a separate endpoint type: passing it AS THE
     * ARGUMENT skips that hook instance entirely, so the query does not exist until
     * the component has something real to ask. The component therefore holds the
     * term in state and starts it at `skipToken`:
     *
     *     const [term, setTerm] = useState(skipToken);
     *     const { data } = useSearchMembersQuery(term);
     *
     * ⚠️ THE CALLER MUST DEBOUNCE. The server's per-user ceiling for this endpoint
     * is 60 per 15 minutes — sized for a debounced type-ahead, not one request per
     * keystroke. `MemberPicker` holds the term in state and only passes a real
     * value 300ms after it stops changing.
     *
     * Matches on `uniID`, `email` AND `fullName`; returns ONLY
     * `{ _id, fullName, uniID, avatar }`. Email is searchable but is deliberately
     * NOT returned — see the server handler's docstring.
     */
    searchMembers: builder.query({
      query: (q) => ({ url: '/participation/member-search', params: { q } }),
    }),

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * `GET /admin/participation/registrations` — the review list.
     *
     * ⚠️ `eventId` IS REQUIRED by the server (400 without it). Admin and moderator
     * may both read; a mentor gets 403.
     *
     * ⚠️ THE LIST IS FILTERED, NOT SCOPED: `status` defaults to `'registered'`, and
     * `'all'` is the value that disables the filter. A row below an event's
     * `teamMinSize` is RETURNED rather than filtered out — this list is the
     * review surface, so the under-sized team is exactly what a reviewer needs to
     * see and decide about.
     */
    getAdminParticipationRegistrations: builder.query({
      query: ({ eventId, status, page, limit }) => ({
        url: '/admin/participation/registrations',
        params: { eventId, status, page, limit },
      }),
      providesTags: (result, error, arg) => [
        { type: 'Participation', id: `admin:${arg?.eventId}:registrations` },
      ],
    }),

    /**
     * `GET /admin/participation/submissions` — the review list.
     *
     * Same auth and same `eventId` requirement. `status` defaults to `'submitted'`,
     * NOT `'registered'`: the two defaults differ because the two lists default to
     * "the things waiting on me", and a submission's waiting state is its review
     * state.
     */
    getAdminParticipationSubmissions: builder.query({
      query: ({ eventId, status, page, limit }) => ({
        url: '/admin/participation/submissions',
        params: { eventId, status, page, limit },
      }),
      providesTags: (result, error, arg) => [
        { type: 'Participation', id: `admin:${arg?.eventId}:submissions` },
      ],
    }),

    /**
     * `PATCH /admin/participation/submissions/:id` — shortlist or reject.
     *
     * ⚠️ ADMIN ONLY. A moderator may read both lists but gets 403 here, so the
     * review ACTIONS must be gated on role, not merely on reaching the page.
     *
     * ⚠️ THE PATH PARAM IS `:id`, NOT `:submissionId`. Easy to get wrong, and the
     * 404 it produces looks like "that submission does not exist" rather than
     * "that route does not exist".
     *
     * ⚠️ ONLY `status` AND `reviewNote` ARE HONOURED — every other key in the body
     * is silently dropped. In particular `reviewedBy` and `reviewedAt` are set from
     * the acting admin and the clock server-side; a client cannot forge them, and
     * a client that tries sends nothing.
     *
     *   `status`     ∈ submitted | shortlisted | rejected
     *   `reviewNote` a string, ≤500 chars after trim
     *
     * ⚠️ `shortlisted → submitted` IS A 409. Shortlisting PUBLISHES an entry on the
     * public winners gallery, so it is not quietly undoable — a mistaken
     * shortlist must be rejected, not reverted. The UI must not offer "move back
     * to submitted" as a reversible action, because it is not one.
     *
     * ⚠️ THIS IS THE ONLY MUTATION THAT INVALIDATES `window:` AND `winners:`.
     * Shortlisting is what changes what the public gallery serves, and an admin
     * reviewing in one tab should see their own decision reflected on the event
     * page in that same tab without a reload.
     */
    reviewParticipationSubmission: builder.mutation({
      query: ({ id, status, reviewNote }) => ({
        url: `/admin/participation/submissions/${id}`,
        method: 'PATCH',
        body: {
          ...(status !== undefined ? { status } : {}),
          ...(reviewNote !== undefined ? { reviewNote } : {}),
        },
      }),
      invalidatesTags: (result, error, arg) => {
        // ⚠️ THE EVENT ID IS READ FROM THE RESPONSE, NOT FROM THE REQUEST ARGUMENT.
        // This is the one mutation on this API where the caller's arg is not a
        // reliable source for the cache keys.
        //
        // `arg.eventId` is an extra field the caller passes purely so the
        // invalidation can work — it is NOT part of the server request. That is
        // fragile in a specific, visible way: any caller that forgets it produces a
        // mutation that SUCCEEDS and invalidates nothing. The admin shortlists an
        // entry, sees the success toast, and the row still reads `submitted` until
        // they reload — with no error anywhere to explain the discrepancy.
        //
        // The response carries `data.eventId` on every admin submission payload
        // (`toWireAdminSubmission` emits it), so deriving the keys from it ties the
        // cache update to data that must have arrived for the toast to have shown.
        // The `arg` branch stays as the fallback for the failure case, where there
        // is no response to read.
        const eventId = result?.data?.eventId ?? arg?.eventId;

        if (!eventId) {
          return [{ type: 'Participation', id: 'mine' }];
        }

        return [
          { type: 'Participation', id: 'mine' },
          { type: 'Participation', id: `admin:${eventId}:submissions` },
          { type: 'Participation', id: `admin:${eventId}:registrations` },
          // ⚠️ THE GALLERY. Shortlisting is the ONLY action in this entire feature
          // that changes what an ANONYMOUS visitor can see, so this is the one
          // public cache entry a mutation here must evict. Without it an admin who
          // shortlisted an entry and then opened the event page in the same tab
          // would see a winners gallery that does not yet contain their decision.
          { type: 'Participation', id: `winners:${eventId}` },
        ];
      },
    }),
  }),
});

export const {
  // public
  useGetEventParticipationWindowQuery,
  useGetEventWinnersQuery,
  // member
  useGetMyRegistrationsQuery,
  useGetRegistrationQuery,
  useCreateEventRegistrationMutation,
  useUpdateRegistrationMutation,
  useWithdrawRegistrationMutation,
  useGetSubmissionQuery,
  useCreateSubmissionMutation,
  useUpdateSubmissionMutation,
  useSearchMembersQuery,
  // admin
  useGetAdminParticipationRegistrationsQuery,
  useGetAdminParticipationSubmissionsQuery,
  useReviewParticipationSubmissionMutation,
} = participationApi;