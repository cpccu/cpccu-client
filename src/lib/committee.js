/**
 * Committee helpers shared by the public committee page and the admin panel.
 *
 * ⚠️ THE CANONICAL COMMITTEE LIST IS NOT HARDCODED HERE. The six committee
 * serials live on the server (`src/utils/committeeRegistry.js`) and reach the
 * browser through `GET /api/v1/certificates/signatories`. Everything below
 * takes that list as an argument, so a committee added on the server is picked
 * up by the client without a client-side change.
 */

/**
 * The positions that are EXECUTIVE positions on a committee.
 *
 * A committee executive must be linked to a user account — that is the rule
 * the admin panel enforces. The positions are the JOB TITLES, not people: no
 * executive name is hardcoded anywhere in the client, because the executives
 * are entered by an admin.
 */
export const COMMITTEE_EXECUTIVE_POSITIONS = [
  'President',
  'Vice President',
  'General Secretary',
  'Treasurer',
  'Joint Secretary',
  'Organizing Secretary',
  'Club Manager',
  'Assistant Club Manager',
  'Joint Treasurer',
  'Media Executive',
  'Joint Media Executive',
  'Creative Executive',
  'Joint Creative Executive',
  'Content Writer',
  'Contest & Events Operations Team',
  'Web Developer',
  'Social Media Manager',
  'Event Organizer',
  'Contest Support Lead',
];

/**
 * The positions that are NOT executive positions.
 *
 * ⚠️ NOT A CLOSED LIST — `position` is free text, so an admin may type a role
 * the club has not seen before. These are the common non-executive titles,
 * offered as suggestions in the admin panel's position field; the executive
 * list above is the one that decides whether a user account is REQUIRED.
 */
export const COMMITTEE_NON_EXECUTIVE_POSITIONS = [
  'Advisor',
  'Executive Member',
  'General Member',
  'Former President',
  'Former Vice President',
  'Alumni',
];

/**
 * Every position the admin panel offers as a suggestion.
 *
 * The executive positions come FIRST, because those are the ones that carry
 * the user-account requirement.
 */
export const COMMITTEE_POSITIONS = [
  ...COMMITTEE_EXECUTIVE_POSITIONS,
  ...COMMITTEE_NON_EXECUTIVE_POSITIONS,
];

const normalise = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

/**
 * Whether a position is an executive position.
 *
 * Case- and whitespace-insensitive: the position is typed by an admin, so
 * "vice  president" and "Vice President" are the same position.
 */
export function isExecutivePosition(position) {
  const value = normalise(position);
  if (!value) return false;
  return COMMITTEE_EXECUTIVE_POSITIONS.some(
    (executive) => normalise(executive) === value
  );
}

/**
 * The first four-digit year in a committee serial — the year the committee's
 * term BEGINS, which is what orders the committees.
 */
export function getCommitteeStartYear(key) {
  const match = /(\d{4})/.exec(String(key || ''));
  return match ? Number(match[1]) : null;
}

const LEGACY_RUNNING_TERM = 'running committee';

/**
 * The committee a member belongs to.
 *
 * `committeeKey` (the serial) is the join key. `term` is only a display name
 * and has been renamed and reused, so it is a FALLBACK for legacy members
 * that predate the serial. A legacy member carrying the default
 * "Running Committee" term belongs to the committee that is running now.
 */
export function resolveCommitteeKey(member, currentKey) {
  const key = member?.committeeKey;
  if (key) return key;

  const term = String(member?.term || '').trim();
  if (!term || normalise(term) === LEGACY_RUNNING_TERM) {
    return currentKey || '';
  }
  return term;
}

const normaliseMember = (member) => ({
  ...member,
  _id: member._id || member.id,
  fullName: member.fullName || member.name,
  avatar: member.avatar || member.img,
  name: member.name || member.fullName,
  img: member.img || member.avatar,
});

/**
 * Groups committee members by committee and orders the groups.
 *
 * @param {Array<object>} members the committee member documents
 * @param {Array<{key: string, label?: string}>} canonicalCommittees the
 *   committee list from the signatories endpoint, in chronological order
 * @param {{order?: 'asc'|'desc'}} [options] `order` only flips the OUTPUT
 *   order: 'asc' (default) lists the committees oldest first, 'desc' lists
 *   them newest first. Any other value falls back to 'asc'.
 * @returns {{groups: Array<object>, currentKey: string|null}} every committee
 *   in the canonical list appears as a group, even when it has no members, so
 *   the page shows the full committee history
 */
export function groupCommitteeMembers(
  members = [],
  canonicalCommittees = [],
  { order = 'asc' } = {},
) {
  const canonical = (canonicalCommittees || []).filter((entry) => entry?.key);
  // The current committee is ALWAYS the last entry of the canonical list,
  // whatever `order` says: the public page finds the current committee by
  // this key, so it must not depend on the group's position in `ordered`.
  const currentKey = canonical.length ? canonical[canonical.length - 1].key : null;
  const direction = order === 'desc' ? -1 : 1;

  const labels = new Map(
    canonical.map((entry) => [entry.key, entry.label || entry.key])
  );
  const groups = new Map();

  const ensureGroup = (key, label) => {
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: label || labels.get(key) || key,
        startYear: getCommitteeStartYear(key),
        members: [],
      });
    }
    return groups.get(key);
  };

  // Every canonical committee gets a group up front — an empty one included.
  canonical.forEach((entry) => ensureGroup(entry.key, entry.label));

  (members || []).forEach((member) => {
    const key = resolveCommitteeKey(member, currentKey);
    if (!key) return;
    const group = ensureGroup(key, member.term);
    group.members.push(normaliseMember(member));
  });

  const ordered = Array.from(groups.values()).sort((a, b) => {
    const aIndex = canonical.findIndex((entry) => entry.key === a.key);
    const bIndex = canonical.findIndex((entry) => entry.key === b.key);
    // A group outside the canonical list (a legacy member grouped by term) is
    // an anomaly, so it sorts after every canonical committee in BOTH orders.
    if (aIndex === -1 && bIndex === -1) {
      return (a.startYear || 0) - (b.startYear || 0) ||
        a.label.localeCompare(b.label);
    }
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return direction * (aIndex - bIndex);
  });

  ordered.forEach((group) => {
    group.members.sort((a, b) => (a.order || 0) - (b.order || 0));
  });

  return { groups: ordered, currentKey };
}
