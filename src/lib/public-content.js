import { toSafeHref } from './hackathon';

export const chooseLiveItems = (response, fallback, mapItem, isLoading = false, isError = false) => {
  if (isLoading) return null;
  if (isError) return fallback;
  const items = response?.data;
  return Array.isArray(items) && items.length ? items.map(mapItem) : fallback;
};

export const toPublicContributor = (contributor) => ({
  id: contributor._id || contributor.id,
  name: contributor.name,
  role: contributor.role || "Contributor",
  contribution: contributor.commits
    ? `Contributed ${contributor.commits} commits to the project`
    : "Contributed to the CPCCU platform",
  github: contributor.githubUrl,
  linkedin: contributor.linkedinUrl,
  avatar: contributor.avatarUrl,
});

export const toPublicDonator = (donator) => ({
  id: donator._id || donator.id,
  name: donator.name,
  organization: "CPCCU Supporter",
  contribution: donator.contribution,
  avatar: donator.avatarUrl,
});

export const toPublicAlumni = (alumni) => ({
  id: alumni._id || alumni.id,
  img: alumni.img || alumni.avatar,
  name: alumni.name,
  position: alumni.position,
  batch: alumni.batch,
  technology: alumni.technology,
  job: alumni.job || {},
  email: alumni.email,
  phone: alumni.phone,
  socials: alumni.socials || {},
});

export const toPublicEvent = (event) => ({
  id: event._id || event.id,
  img: event.image,
  alt: event.title,
  eventHeadLine1: event.eventHeadLine1 || event.title,
  textContext: event.description,
  eventHeadLine2: event.eventHeadLine2 || "Reward",
  reward: event.reward || "Organized by CPCCU",
  eventHeadLine3: event.eventHeadLine3 || "Event Details",
  rules1: event.rules1 || (event.location ? `Location: ${event.location}` : "Hosted by CPCCU"),
  rules2: event.rules2 || (event.organizer ? `Organizer: ${event.organizer}` : ""),
  rules3: event.rules3 || (event.type ? `Type: ${event.type}` : ""),
  rules4: event.rules4 || (event.status ? `Status: ${event.status}` : ""),
  btnText: event.btnText || (event.registrationLink ? "Register" : event.contestLink ? "Open Event" : ""),
  // ⚠️ READ-TIME BACKSTOP — these two fields are the only URL-bearing output of
  // this mapper, and `UpComingEventCard` puts each one straight into an `href`
  // (its `btnLink` / `btnLink1` `<Link>` elements). They are therefore
  // sanitised HERE, at the mapper, with the SAME `toSafeHref` policy
  // `toPublicHackathon` already uses — the same helper, not a second policy.
  //
  // Write-time validation on the server is NOT sufficient protection for this
  // path, for two reasons that are both real in this data set:
  //   1. `registrationLink`, `btnLink` and `btnLink1` were bare `String`s until
  //      the hackathon feature, so documents written before the validators
  //      landed can already hold `javascript:` / `data:` values, and
  //   2. the seed script can still write with validators disabled.
  // A poisoned value already in Mongo would otherwise be served and rendered.
  //
  // Blanking an unsafe value degrades the field to "no link" — the card's
  // `data?.btnLink ? … : null` guard then omits the button entirely, which is
  // the correct outcome for a value that should never have been linkable.
  // This does not weaken the server's write-time validation; it is the second
  // of the two independent gates.
  //
  // NOT sanitised: `img`. It is rendered as an `<img src>`, never as an `href`,
  // so it is not a script-execution sink, and `toSafeHref` would reject the
  // root-relative upload paths (`/uploads/…`) that legitimately live there.
  // Do not "tidy" this by wrapping `img` as well.
  btnLink: toSafeHref(event.btnLink || event.registrationLink || event.contestLink || event.meetLink || ""),
  btnText1: event.btnText1 || (event.contestLink ? "Contest Link" : ""),
  btnLink1: toSafeHref(event.btnLink1 || event.contestLink || ""),
  // ⚠️ `eventStartAt`/`eventEndAt` → `startAt`/`endAt`. The schema is being renamed
  // to say what each field is (the window instants got the same treatment, and
  // `date` was ambiguous next to `registrationCloseAt`/`submissionCloseAt`), and
  // this mapper is exactly where the old names are allowed to stop existing. A
  // component can only read `startAt`, so renaming here is what keeps the schema
  // name out of every one of them — the same convention as `location` → `venue`.
  startAt: event.eventStartAt || null,
  endAt: event.eventEndAt || null,
  // ⚠️ `participationEnabled` IS READ FROM THE UNPROJECTED LIST PAYLOAD, which is
  // what makes this mapper's job possible without a second request.
  //
  // `GET /content/events` returns the whole Event document minus
  // `hackathonProblemSetUrl`, so `registrationEnabled` / `submissionEnabled` are
  // already present on each row. The DETAIL endpoint deliberately excludes them
  // (`PUBLIC_EVENT_DETAIL_PROJECTION`) because that page resolves them into an
  // `open` boolean from a dedicated endpoint — but a card has no window to resolve
  // against and only needs to know one bit: is this event run through the in-app
  // flow?
  //
  // It is a MODE flag for the card, not a gate. The card uses it for ONE decision:
  // whether its primary button opens the detail page or the admin's external form.
  // It never renders "registration is open" from this, because `enabled` is
  // date-independent — an event switched on six months ago and long finished still
  // has `registrationEnabled === true`. That is exactly the class of lie the
  // `status` field below already causes and that `PHASE_TILES` was written to
  // avoid, and it is why this flag is used only to choose a destination.
  //
  // `=== true` rather than a truthiness test, mirroring the server's
  // `resolveActionWindow`: a document written before the field existed reads as
  // `undefined`, and Mongoose's schema default applies only to writes, so an
  // undefined value must mean "no participation", not "maybe".
  participationEnabled:
    event.registrationEnabled === true || event.submissionEnabled === true,
  // ⚠️ The ONE place the client decides "is this row a hackathon?".
  //
  // The hackathon is an ordinary Event document with `type: 'hackathon'`, so it
  // also arrives in the generic `GET /content/events` list that `/event` and
  // the homepage carousel render through `UpComingEventCard`. That card is
  // phase-blind: it has no notion of upcoming/live/ended, so a finished
  // hackathon keeps rendering its "Register" button and its free-text
  // `rules4` status line forever, and an admin-disabled hackathon still shows
  // up as a normal event card.
  //
  // The flag lives HERE rather than being re-derived in each consumer so the
  // decision is made once, in the mapper, and every list consumer can only
  // obey it. There are exactly TWO public consumers of the events list, and
  // both filter on this one flag — `NoticeSection` (the `/event` page) and
  // `EventLayout` (the homepage carousel). The admin surface
  // `events-content.jsx` reads the raw document via `useAdminContent('events')`
  // and is intentionally NOT filtered, because an admin must still be able to
  // see that a hackathon exists. The card itself does not need to know.
  //
  // It is also the forward-compatible shape: if the server later omits
  // `type: 'hackathon'` from `listPublicContent('events')` — the thorough fix —
  // these rows simply never arrive, `isHackathon` is absent everywhere, and
  // the client-side filter becomes a no-op rather than a second, divergent
  // rule. `event.type === 'hackathon'` (rather than a truthiness test) is
  // deliberate: an absent `type` must NOT be treated as a hackathon.
  isHackathon: event.type === 'hackathon',
});

/**
 * Maps `GET /content/hackathon` → the shape the hackathon components read.
 *
 * Every URL on this record is passed through `toSafeHref`, the client mirror
 * of the server's URL policy, and anything unsafe becomes `''`. Why that
 * matters even though the server validates on write: a value that was already
 * in the database before the validator existed, or that was hand-edited in
 * Mongo, would otherwise reach React as an `href` and render as a working
 * `javascript:` link. Blanking it degrades the field to "no link", which is
 * the correct outcome for a bad value.
 *
 * Field renames are deliberate — the server names are model names
 * (`location`, `registrationLink`) and leaking them into components
 * would couple the UI to the schema. This is the same convention as every
 * other `toPublicX` in this file (doc.md §8.4 / §10.5).
 *
 * ⚠️ `chooseLiveItems` DOES NOT APPLY HERE. That primitive is array-shaped: it
 * reads `response.data` and calls `.map()`, so it cannot express a singleton
 * resource, and its `fallback` semantics ("show demo data on error") are wrong
 * for a page whose entire content is one record. The hackathon page therefore
 * uses explicit loading / error / empty branches, following the pattern in
 * `src/components/Layout/JobPipeline.jsx:60-81`. This is a conscious deviation
 * forced by the singleton shape, not an oversight.
 *
 * `phase` is passed through verbatim. The server resolved it once at request
 * time; the countdown re-derives it locally every second so the UI can cross a
 * boundary without a refetch. Re-computing it here would throw away the
 * server's authoritative answer for no benefit.
 *
 * ⚠️ `status` IS DELIBERATELY ABSENT, and must not be added back. It is a
 * free-text admin field on the Event document that can permanently disagree
 * with the server-derived `phase` — an admin can mark a finished hackathon
 * "ongoing" and the public page would then contradict its own countdown. The
 * public payload therefore carries only `phase`, and the page renders a
 * phase-derived label. The field still exists on the ADMIN side (which reads
 * the raw document via `useAdminContent('events')`) and is still carried
 * through every hackathon write so an Events-page save does not clobber it; it
 * is bookkeeping, not the source of truth for phase.
 */
export const toPublicHackathon = (hackathon) => ({
  id: hackathon._id || hackathon.id,
  title: hackathon.title || '',
  description: hackathon.description || '',
  image: hackathon.image || '',
  // `location` → `venue`: components talk about where an event happens, and
  // `location` is a schema word.
  venue: hackathon.location || '',
  organizer: hackathon.organizer || '',
  type: hackathon.type || 'hackathon',
  startAt: hackathon.startAt || null,
  endAt: hackathon.endAt || null,
  registrationUrl: toSafeHref(hackathon.registrationLink),
  ctaLabel: hackathon.ctaLabel || 'Register Now',
  ruleBookUrl: toSafeHref(hackathon.ruleBookUrl),
  // Public, and deliberately NOT gated the way `hackathonProblemSetUrl` is on
  // the server: a submission form is the participation path, so a participant
  // has to be able to find it. Same `toSafeHref` treatment as every other
  // admin-supplied href, so a poisoned stored value degrades to `''` and the
  // CTA renders nothing rather than becoming a live link.
  submissionUrl: toSafeHref(hackathon.submissionUrl),
  // ADVISORY ONLY — it decides whether the problem-set affordance is offered.
  // The real gate is the `verifyToken` + start-time protected endpoint, so
  // forging this in the browser earns a 403 and nothing else.
  problemSetAvailable: Boolean(hackathon.problemSetAvailable),
  phase: hackathon.phase || 'unannounced',
});

/**
 * Maps `GET /content/events/:eventId` → the shape the event DETAIL page reads.
 *
 * ⚠️ THIS IS NOT AN EXTENSION OF `toPublicEvent`, and it is a separate function
 * rather than a superset for two reasons that are both load-bearing:
 *
 *   1. The two endpoints return DIFFERENT THINGS. The list is unprojected and the
 *      card needs a fixed, minimal set of words; the detail endpoint carries an
 *      explicit allowlist and the page needs everything in it. Making one mapper
 *      serve both means every field the detail page gains has to be added to a
 *      mapper the `/event` list also depends on — widening the blast radius of an
 *      additive change on the card.
 *
 *   2. ⚠️ `status` IS DELIBERATELY ABSENT, AND THAT IS A DIFFERENT DECISION HERE
 *      THAN IN `toPublicEvent`. `toPublicEvent` DOES fall back to the free-text
 *      `status` for its `rules4` line, and that is a long-standing behaviour on
 *      the card. The detail page must not repeat it: the server's projection for
 *      this endpoint excludes `status` entirely (see
 *      `PUBLIC_EVENT_DETAIL_PROJECTION`), precisely because it is the one field
 *      that can permanently contradict the dates the detail page renders right
 *      next to it. So there is nothing to leak here — and the mapper must not
 *      reintroduce a dependency on a field the server does not send.
 *
 * EVERY URL IS `toSafeHref`'d, exactly as in `toPublicEvent` and
 * `toPublicHackathon` — the same helper, not a second policy. The server
 * validates these on write with `adminEventUrl()`; this is the read-time backstop
 * for a value stored before that validator existed or hand-edited in Mongo.
 *
 * The link fields are kept SEPARATE rather than collapsed into one `primaryLink`,
 * because the detail page has to render them differently by destination: the
 * external ones are plain anchors with `rel="noopener noreferrer"` (the EXTERNAL
 * LINK RULE), and none of them are ever internal routes. Collapsing them would
 * lose the ability to label each one (`rules3`/`rules4` text tells the reader what
 * a link IS before they click it) and would make a single unsafe value blank all
 * the others.
 */
export const toPublicEventDetail = (event) => ({
  id: event._id || event.id,
  title: event.title || '',
  // `description` → `summary`, matching the card's `textContext` convention of not
  // leaking a schema field name into components.
  summary: event.description || '',
  img: event.image || '',
  location: event.location || '',
  organizer: event.organizer || '',
  type: event.type || '',

  // `eventStartAt`/`eventEndAt` → `startAt`/`endAt`, the SAME rename
  // `toPublicHackathon` already used for the hackathon's wire keys, so a component
  // that handles both record types reads the same field names for the same concept.

  // The three headline / sub-headline slots are ADMIN-AUTHORED display text that
  // may be blank. They are carried verbatim — with a fallback to the event title
  // for `headline` only — rather than invented, because the admin chose them. An
  // empty `headline` therefore means "the admin left this blank", and the page
  // falls back rather than showing an empty heading.
  headline: event.eventHeadLine1 || event.title || '',
  headlineSecondary: event.eventHeadLine2 || '',
  headlineTertiary: event.eventHeadLine3 || '',
  reward: event.reward || '',

  // The four free-text detail lines, kept as an ARRAY rather than as
  // `rules1..rules4`. The card needs them positionally because its layout is
  // positional; the detail page needs to filter empties and list them. An array
  // makes "drop the empty ones" a one-line filter instead of four
  // `x ? <li> : null` branches that can drift out of alignment.
  details: [event.rules1, event.rules2, event.rules3, event.rules4]
    .filter((line) => typeof line === 'string' && line.trim() !== '')
    .map((line) => line.trim()),

  // ⚠️ `registrationUrl` IS THE EXTERNAL-FALLBACK SLOT ONLY. Whether the Register
  // button points HERE or at the in-app page is decided by
  // `resolveRegistrationTarget` in `@/lib/participation.js`, which needs the
  // participation window as well as this URL. Deciding it here would mean this
  // mapper had to fetch a second endpoint, turning a pure mapping function into a
  // network call — and the decision would then be made in two places.
  registrationUrl: toSafeHref(event.registrationLink),

  // The remaining admin-authored outbound links for a non-hackathon event. All
  // sanitised, all rendered as plain anchors.
  contestUrl: toSafeHref(event.contestLink),
  meetUrl: toSafeHref(event.meetLink),
  vjudgeUrl: toSafeHref(event.vjudgeGroupLink),
  btnLink: toSafeHref(event.btnLink),
  btnText: event.btnText || '',
  btnLink1: toSafeHref(event.btnLink1),
  btnText1: event.btnText1 || '',
});

export const toPublicGalleryItem = (item) => ({
  id: item._id || item.id,
  img: item.imageUrl,
  tag: `all ${item.category || "event"}`,
  header: item.title,
  date: new Date(item.uploadedAt || item.createdAt || Date.now()).toLocaleDateString(),
  eventId: item.eventId?._id || item.eventId || null,
  eventTitle: item.eventTitle || (item.eventId && typeof item.eventId === 'object' ? item.eventId.title : null),
  eventDescription: item.eventDescription || (item.eventId && typeof item.eventId === 'object' ? item.eventId.description : null),
});

export const groupGalleryItemsByEvent = (items, eventMap = {}) => {
  const groups = {};
  items.forEach(item => {
    const eventId = item.eventId || 'ungrouped';
    const event = eventMap[eventId];
    if (!groups[eventId]) {
      groups[eventId] = {
        header: event?.title || item.eventTitle || 'Ungrouped Photos',
        conText: event?.description || item.eventDescription || 'Photos from various events.',
        eventDate: event?.eventDate || item.eventDate,
        eventId: eventId === 'ungrouped' ? null : eventId,
        element: [],
      };
    }
    groups[eventId].element.push({
      id: item.id,
      img: item.img,
      header: item.header,
      date: item.date,
    });
  });
  return Object.values(groups);
};

/**
 * Extract a GitHub username from various GitHub URL formats.
 * Supported:
 *   https://github.com/username
 *   http://github.com/username
 *   github.com/username
 *   username (bare username)
 * Returns lowercase username or null.
 */
export function extractGithubUsername(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Try to match github.com/username pattern
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9._-]+)(?:\/.*)?$/
  );
  if (match) {
    return match[1].toLowerCase();
  }

  // If the string looks like a bare username (no dots, no http), use it directly
  if (/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return null;
}

/**
 * Find a contributor record from the contributors JSON by GitHub username.
 * Returns the contributor object or null.
 */
export function findContributorByGithub(githubUrl, contributors) {
  if (!githubUrl || !Array.isArray(contributors) || !contributors.length) return null;
  const username = extractGithubUsername(githubUrl);
  if (!username) return null;
  return contributors.find(
    (c) => extractGithubUsername(c.github) === username
  ) || null;
}

/**
 * Normalize a contributor's contribution text into structured data.
 */
export function parseContributionInfo(contributor) {
  if (!contributor) return null;
  const text = contributor.contribution || '';
  const commitMatch = text.match(/(\d+)\s+commits?/i);
  return {
    commitCount: commitMatch ? parseInt(commitMatch[1], 10) : null,
    displayText: text,
    avatar: contributor.avatar || null,
    name: contributor.name || null,
    batch: contributor.batch || null,
    department: contributor.department || null,
    rank: contributor.rank || null,
  };
}

export const toPublicDeveloperProfile = (profile) => ({
  id: profile._id || profile.id,
  img: profile.photoUrl,
  name: profile.name,
  tag: profile.title,
  email: profile.email,
  phone: profile.phone,
  socials: {
    github: profile.githubUrl,
    linkedin: profile.linkedinUrl,
    portfolio: profile.portfolioUrl,
  },
  skills: (profile.skills || []).map((skill) => ({
    skillName: skill.skillName || skill.name,
    experience: skill.experience || skill.description,
  })),
  createdAt: profile.memberSince || profile.submittedAt || profile.createdAt,
});
