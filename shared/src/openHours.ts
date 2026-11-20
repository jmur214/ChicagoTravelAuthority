import { z } from 'zod';

/**
 * Weekly opening hours, stored as JSON on `Location.openHours`.
 *
 * Times are "HH:MM" (24h) in Chicago local time. A `close` that is earlier
 * than or equal to `open` means the venue closes after midnight
 * (e.g. open 17:00, close 02:00).
 */
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const CHICAGO_TIME_ZONE = 'America/Chicago';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TimeWindowSchema = z.object({
    open: z.string().regex(HHMM, 'Expected HH:MM'),
    close: z.string().regex(HHMM, 'Expected HH:MM'),
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

/**
 * One day's hours. `open`/`close` is the first window; `additional` holds any
 * later windows the same day (e.g. lunch 11–2, then dinner 5–10).
 * 00:00–00:00 means open all day.
 */
export const DayHoursSchema = TimeWindowSchema.extend({
    isOpen: z.boolean(),
    additional: z.array(TimeWindowSchema).max(5).optional(),
});
export type DayHours = z.infer<typeof DayHoursSchema>;

export const OpenHoursSchema = z.object({
    mon: DayHoursSchema.optional(),
    tue: DayHoursSchema.optional(),
    wed: DayHoursSchema.optional(),
    thu: DayHoursSchema.optional(),
    fri: DayHoursSchema.optional(),
    sat: DayHoursSchema.optional(),
    sun: DayHoursSchema.optional(),
});
export type OpenHours = z.infer<typeof OpenHoursSchema>;

export const DEFAULT_DAY_HOURS: DayHours = { isOpen: false, open: '09:00', close: '17:00' };
export const CLOSED_DAY: DayHours = { isOpen: false, open: '00:00', close: '00:00' };

export type OpenStatus =
    | { state: 'open'; closesAt: string }
    | { state: 'closed'; opensAt?: string }
    | { state: 'unknown' };

const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
    Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun',
};

/** Day-of-week and minutes-since-midnight for `date` in the given time zone. */
export function getZonedDayAndMinutes(date: Date, timeZone: string = CHICAGO_TIME_ZONE): { day: DayKey; minutes: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    return {
        day: WEEKDAY_TO_KEY[get('weekday')],
        minutes: Number(get('hour')) * 60 + Number(get('minute')),
    };
}

const previousDay = (day: DayKey): DayKey => DAY_KEYS[(DAY_KEYS.indexOf(day) + 6) % 7];

const spansMidnight = (w: TimeWindow) => toMinutes(w.close) <= toMinutes(w.open);

/** All open windows for a day, earliest first. */
export const dayWindows = (h: DayHours | undefined): TimeWindow[] =>
    h?.isOpen ? [{ open: h.open, close: h.close }, ...(h.additional ?? [])] : [];

/**
 * Whether a venue is open at `date`. Missing days are treated as closed;
 * missing hours altogether yield `unknown`, so callers can decide how
 * to treat venues without data.
 */
export function getOpenStatus(
    hours: OpenHours | null | undefined,
    date: Date,
    timeZone: string = CHICAGO_TIME_ZONE,
): OpenStatus {
    if (!hours) return { state: 'unknown' };

    const { day, minutes } = getZonedDayAndMinutes(date, timeZone);

    // Still inside one of yesterday's after-midnight windows?
    for (const w of dayWindows(hours[previousDay(day)])) {
        if (spansMidnight(w) && minutes < toMinutes(w.close)) return { state: 'open', closesAt: w.close };
    }

    const today = dayWindows(hours[day]);
    for (const w of today) {
        const open = toMinutes(w.open);
        const inside = spansMidnight(w) ? minutes >= open : minutes >= open && minutes < toMinutes(w.close);
        if (inside) return { state: 'open', closesAt: w.close };
    }

    const next = today.map(w => w.open).filter(o => toMinutes(o) > minutes).sort()[0];
    return next ? { state: 'closed', opensAt: next } : { state: 'closed' };
}

const isAllDay = (w: TimeWindow) => w.open === '00:00' && w.close === '00:00';

/** "5:00 PM – 2:00 AM", "11:00 AM – 2:00 PM, 5:00 PM – 10:00 PM", "Open 24 hours" or "Closed". */
export function describeDayHours(h: DayHours | undefined): string {
    const windows = dayWindows(h);
    if (!windows.length) return 'Closed';
    if (windows.some(isAllDay)) return 'Open 24 hours';
    return windows.map(w => `${formatHHMM(w.open)} – ${formatHHMM(w.close)}`).join(', ');
}

/** "17:00" -> "5:00 PM" */
export function formatHHMM(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}
