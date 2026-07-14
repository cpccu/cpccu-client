// src/lib/roles.js — Shared CPCCU role utilities

/**
 * The canonical list of official CPCCU role names (used as fallback).
 * When a role is assigned from the backend, it's validated against these.
 */
const DEFAULT_CPCCU_ROLES = [
  'President',
  'Vice President',
  'General Secretary',
  'Treasurer',
  'Social Media Manager',
  'Event Organizer',
  'Advisor',
  'Former President',
  'Former Vice President',
  'Alumni',
];

const DEFAULT_ROLES_LOWERCASE = DEFAULT_CPCCU_ROLES.map((r) =>
  r.toLowerCase().trim()
);

/**
 * Normalize a role name: trim, capitalize first letter of each word.
 */
export function normalizeRole(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Check whether a role name is one of the known official CPCCU roles.
 */
export function isOfficialRole(role) {
  if (!role || typeof role !== 'string') return false;
  return DEFAULT_ROLES_LOWERCASE.includes(role.toLowerCase().trim());
}

/**
 * Determine the display role for a member.
 * Returns the official role if recognized, otherwise "Member".
 */
export function getDisplayRole(officialRole) {
  if (!officialRole || typeof officialRole !== 'string') return 'Member';
  const trimmed = officialRole.trim();
  if (!trimmed) return 'Member';
  // Always display the role that was assigned, but fall back to "Member"
  // if it's a system permission (admin, moderator, mentor, etc.)
  const systemRoles = ['admin', 'moderator', 'mentor', 'member', 'developer'];
  if (systemRoles.includes(trimmed.toLowerCase())) {
    return 'Member';
  }
  return trimmed;
}

/**
 * Role icon mapping for the profile hero badge.
 */
const ROLE_ICONS = {
  president: '👑',
  'vice president': '👑',
  'general secretary': '🛡',
  treasurer: '💼',
  'social media manager': '📱',
  'event organizer': '📅',
  advisor: '🎓',
  'former president': '🎖',
  'former vice president': '🎖',
  alumni: '👨‍🎓',
};

/**
 * Get the emoji icon for a CPCCU role.
 */
export function roleIcon(role) {
  if (!role || typeof role !== 'string') return '⭐';
  return ROLE_ICONS[role.toLowerCase().trim()] ?? '⭐';
}

/**
 * Get badge color class for a role.
 */
export function roleBadgeColor(role) {
  if (!role || typeof role !== 'string') return 'bg-muted text-muted-foreground';
  const lower = role.toLowerCase().trim();
  if (lower === 'president' || lower === 'vice president') {
    return 'bg-primary text-primary-foreground';
  }
  if (lower === 'general secretary' || lower === 'treasurer') {
    return 'bg-chart-2 text-white';
  }
  if (lower === 'advisor' || lower === 'former president') {
    return 'bg-chart-4 text-white';
  }
  return 'bg-accent text-accent-foreground';
}

/**
 * Sort roles alphabetically (case-insensitive).
 */
export function sortRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return [...roles].sort((a, b) => {
    const nameA = (a.name || a).toLowerCase();
    const nameB = (b.name || b).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export { DEFAULT_CPCCU_ROLES, DEFAULT_ROLES_LOWERCASE };
