export const DEFAULT_COMMITTEE_TENURES = [
  {
    key: 'founding-committee-2022-2023',
    label: 'Founding Committee 2022-2023',
    startDate: '2022-10-20T00:00:00.000Z',
    endDate: '2023-04-10T23:59:59.999Z',
    order: 1,
  },
  {
    key: 'committee-2023-2024',
    label: 'Committee 2023-2024',
    startDate: '2023-04-11T00:00:00.000Z',
    endDate: '2024-01-09T23:59:59.999Z',
    order: 2,
  },
  {
    key: 'committee-2024-2025',
    label: 'Committee 2024-2025',
    startDate: '2024-01-10T00:00:00.000Z',
    endDate: '2025-09-30T23:59:59.999Z',
    order: 3,
  },
  {
    key: 'committee-2025-2026',
    label: 'Committee 2025-2026',
    startDate: '2025-10-01T00:00:00.000Z',
    endDate: '2026-07-31T23:59:59.999Z',
    order: 4,
  },
  {
    key: 'interim-committee-2026-2026',
    label: 'Interim Committee 2026-2026',
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-09-16T23:59:59.999Z',
    order: 5,
  },
  {
    key: 'committee-2026-2027',
    label: 'Committee 2026-2027',
    startDate: '2026-09-17T00:00:00.000Z',
    endDate: null,
    order: 6,
  },
];

/**
 * Resolves which committee was active/running on a given date.
 * @param {Date|string|number} date
 * @param {Array} [tenures] list of committee objects with key, startDate, endDate
 * @returns {string} committee key
 */
export function resolveCommitteeKeyByDate(date, tenures = DEFAULT_COMMITTEE_TENURES) {
  const list = Array.isArray(tenures) && tenures.length > 0 ? tenures : DEFAULT_COMMITTEE_TENURES;
  const latestKey = list[list.length - 1]?.key || 'committee-2026-2027';

  if (!date) return latestKey;
  const targetTime = new Date(date).getTime();
  if (isNaN(targetTime)) return latestKey;

  for (const item of list) {
    const start = item.startDate ? new Date(item.startDate).getTime() : -Infinity;
    const end = item.endDate ? new Date(item.endDate).getTime() : Infinity;
    if (targetTime >= start && targetTime <= end) {
      return item.key;
    }
  }

  const sorted = [...list].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  if (targetTime < new Date(sorted[0].startDate).getTime()) {
    return sorted[0].key;
  }
  return sorted[sorted.length - 1].key;
}

/**
 * Formats a tenure range for display, e.g. "20 Oct 2022 – 10 Apr 2023" or "17 Sep 2026 – Present"
 */
export function formatTenureRange(startDate, endDate) {
  if (!startDate) return 'Not set';
  const start = new Date(startDate);
  const startStr = start.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (!endDate) {
    return `${startStr} – Present`;
  }
  const end = new Date(endDate);
  const endStr = end.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}
