import { CHICAGO_TIME_ZONE } from './openHours';

/**
 * Everything in this app happens in Chicago, so user-entered times ("8 PM")
 * mean Chicago wall-clock time no matter where the device is — a visitor
 * planning from New York or a phone still on home time must get the same result.
 */

interface WallTime { year: number; month: number; day: number; hour: number; minute: number }

function wallTime(date: Date, timeZone: string): WallTime {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const n = (type: string) => Number(parts.find(p => p.type === type)?.value);
    return { year: n('year'), month: n('month'), day: n('day'), hour: n('hour'), minute: n('minute') };
}

const asUtcMs = (w: WallTime) => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DDTHH:mm" (as from <input type="datetime-local">) in `timeZone` -> Date. */
export function zonedWallTimeToDate(value: string, timeZone: string = CHICAGO_TIME_ZONE): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!match) throw new Error(`Invalid local date-time: "${value}"`);
    const [, year, month, day, hour, minute] = match.map(Number);
    const target = asUtcMs({ year, month, day, hour, minute });

    // Start by pretending the zone is UTC, then correct by the observed offset.
    // A second pass settles cases that straddle a DST change.
    let guess = target;
    for (let i = 0; i < 2; i++) guess += target - asUtcMs(wallTime(new Date(guess), timeZone));
    return new Date(guess);
}

/** Date -> "YYYY-MM-DDTHH:mm" wall-clock time in `timeZone` (for datetime-local inputs). */
export function toZonedWallTime(date: Date, timeZone: string = CHICAGO_TIME_ZONE): string {
    const w = wallTime(date, timeZone);
    return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** ISO instant -> "8:30 PM" in `timeZone`. */
export function formatTimeInZone(iso: string | Date, timeZone: string = CHICAGO_TIME_ZONE): string {
    return new Date(iso).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}
