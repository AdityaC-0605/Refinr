import { Timestamp } from 'firebase-admin/firestore';

/**
 * Normalizes Firestore Timestamps, JS Dates, or ISO strings
 * to a standardized ISO-8601 string.
 */
export function toIsoString(value: Timestamp | Date | string | undefined): string {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    return new Date().toISOString();
}
