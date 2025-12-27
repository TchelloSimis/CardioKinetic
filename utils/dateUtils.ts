/**
 * Timezone-agnostic date utilities.
 * 
 * All dates in this app represent CALENDAR DATES (not timestamps).
 * They are always based on LOCAL time and stored as YYYY-MM-DD strings.
 * 
 * IMPORTANT: Never use toISOString().split('T')[0] for date-only operations!
 * That returns UTC date which can differ from local date near midnight.
 */

/**
 * Get a date as YYYY-MM-DD string in LOCAL time.
 * This is the primary way to get "today" or format any date for storage.
 * 
 * @param date - Date object (defaults to now)
 * @returns YYYY-MM-DD string in local time
 */
export function getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to a Date at local midnight.
 * Does NOT interpret the string as UTC - the date components are used directly.
 * 
 * @param dateStr - YYYY-MM-DD format string
 * @returns Date object at local midnight
 */
export function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get the number of days between two YYYY-MM-DD strings.
 * Result is positive if date2 is after date1.
 * 
 * @param dateStr1 - Start date (YYYY-MM-DD)
 * @param dateStr2 - End date (YYYY-MM-DD)
 * @returns Number of days (can be negative)
 */
export function getDaysBetween(dateStr1: string, dateStr2: string): number {
    const d1 = parseLocalDate(dateStr1);
    const d2 = parseLocalDate(dateStr2);
    const diffMs = d2.getTime() - d1.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a YYYY-MM-DD string.
 * 
 * @param dateStr - Starting date (YYYY-MM-DD)
 * @param days - Number of days to add (can be negative)
 * @returns New date string (YYYY-MM-DD)
 */
export function addDays(dateStr: string, days: number): string {
    const date = parseLocalDate(dateStr);
    date.setDate(date.getDate() + days);
    return getLocalDateString(date);
}

/**
 * Compare two YYYY-MM-DD strings chronologically.
 * 
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareDates(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Check if a date is within a range (inclusive on both ends).
 * 
 * @param dateStr - Date to check (YYYY-MM-DD)
 * @param startStr - Range start (YYYY-MM-DD)
 * @param endStr - Range end (YYYY-MM-DD)
 * @returns true if dateStr is between startStr and endStr inclusive
 */
export function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
    return dateStr >= startStr && dateStr <= endStr;
}

/**
 * Check if a date is before another date.
 */
export function isBefore(dateStr: string, otherStr: string): boolean {
    return dateStr < otherStr;
}

/**
 * Check if a date is after another date.
 */
export function isAfter(dateStr: string, otherStr: string): boolean {
    return dateStr > otherStr;
}

/**
 * Check if a date is on or before another date.
 */
export function isOnOrBefore(dateStr: string, otherStr: string): boolean {
    return dateStr <= otherStr;
}

/**
 * Check if a date is on or after another date.
 */
export function isOnOrAfter(dateStr: string, otherStr: string): boolean {
    return dateStr >= otherStr;
}

/**
 * Format a YYYY-MM-DD string for short display (e.g., "15/Ja").
 * 
 * @param dateStr - YYYY-MM-DD format string
 * @returns Short display format like "15/Ja"
 */
export function formatDateShort(dateStr: string): string {
    const [, month, day] = dateStr.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}/${monthNames[month - 1].slice(0, 2)}`;
}

/**
 * Get the week number (1-indexed) for a date relative to a start date.
 * Week 1 starts on day 0-6, Week 2 on day 7-13, etc.
 * Returns 0 for dates before the start date.
 * 
 * @param dateStr - The date to check (YYYY-MM-DD)
 * @param startStr - The program/reference start date (YYYY-MM-DD)
 * @returns Week number (1-indexed) or 0 if before start
 */
export function getWeekNumber(dateStr: string, startStr: string): number {
    const diffDays = getDaysBetween(startStr, dateStr);
    if (diffDays < 0) return 0;
    return Math.floor(diffDays / 7) + 1;
}

/**
 * Get the day index (0-indexed) for a date relative to a start date.
 * 
 * @param dateStr - The date to check (YYYY-MM-DD)
 * @param startStr - The reference start date (YYYY-MM-DD)
 * @returns Day index (0 = start date, 1 = next day, etc.) or negative if before
 */
export function getDayIndex(dateStr: string, startStr: string): number {
    return getDaysBetween(startStr, dateStr);
}
