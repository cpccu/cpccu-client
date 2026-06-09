import { format } from 'date-fns';
/**
 * Formats a date string deterministically using UTC to avoid
 * hydration mismatches between server and client timezones.
 */
export function formatDate(dateString, pattern = 'MMM dd, yyyy') {
    return format(new Date(dateString), pattern);
}
