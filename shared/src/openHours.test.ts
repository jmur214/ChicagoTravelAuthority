import { describe, expect, it } from 'vitest';
import { formatHHMM, getOpenStatus, getZonedDayAndMinutes, type OpenHours } from './openHours';

// All instants are given in UTC so the tests don't depend on the machine's TZ.
// Chicago is UTC-6 in November (CST) and UTC-5 in July (CDT).

const bar: OpenHours = {
    mon: { isOpen: true, open: '17:00', close: '02:00' },
    tue: { isOpen: false, open: '00:00', close: '00:00' },
    fri: { isOpen: true, open: '16:00', close: '03:00' },
    sat: { isOpen: true, open: '11:00', close: '23:00' },
};

describe('getZonedDayAndMinutes', () => {
    it('converts to Chicago local time regardless of host timezone', () => {
        // Tue 2026-11-17 03:30Z == Mon 2026-11-16 21:30 CST
        expect(getZonedDayAndMinutes(new Date('2026-11-17T03:30:00Z'))).toEqual({ day: 'mon', minutes: 21 * 60 + 30 });
    });

    it('handles daylight saving time', () => {
        // Wed 2026-07-15 17:00Z == Wed 12:00 CDT
        expect(getZonedDayAndMinutes(new Date('2026-07-15T17:00:00Z'))).toEqual({ day: 'wed', minutes: 12 * 60 });
    });
});

describe('getOpenStatus', () => {
    it('returns unknown when there are no hours', () => {
        expect(getOpenStatus(null, new Date())).toEqual({ state: 'unknown' });
        expect(getOpenStatus(undefined, new Date())).toEqual({ state: 'unknown' });
    });

    it('is open during a normal evening window', () => {
        // Mon 21:30 CST
        expect(getOpenStatus(bar, new Date('2026-11-17T03:30:00Z'))).toEqual({ state: 'open', closesAt: '02:00' });
    });

    it("stays open past midnight on the previous day's hours", () => {
        // Tue 01:30 CST — Tuesday itself is closed, but Monday runs until 02:00
        expect(getOpenStatus(bar, new Date('2026-11-17T07:30:00Z'))).toEqual({ state: 'open', closesAt: '02:00' });
    });

    it('closes once the after-midnight window ends', () => {
        // Tue 02:30 CST
        expect(getOpenStatus(bar, new Date('2026-11-17T08:30:00Z'))).toEqual({ state: 'closed' });
    });

    it('reports the opening time when closed earlier in the day', () => {
        // Mon 10:00 CST
        expect(getOpenStatus(bar, new Date('2026-11-16T16:00:00Z'))).toEqual({ state: 'closed', opensAt: '17:00' });
    });

    it('closes at the end of a same-day window', () => {
        // Sat 23:30 CST
        expect(getOpenStatus(bar, new Date('2026-11-22T05:30:00Z'))).toEqual({ state: 'closed' });
    });

    it('treats days missing from the object as closed', () => {
        // Wed 20:00 CST — no "wed" key
        expect(getOpenStatus(bar, new Date('2026-11-19T02:00:00Z'))).toEqual({ state: 'closed' });
    });
});

describe('formatHHMM', () => {
    it.each([
        ['00:00', '12:00 AM'],
        ['09:05', '9:05 AM'],
        ['12:00', '12:00 PM'],
        ['17:30', '5:30 PM'],
    ])('%s -> %s', (input, expected) => {
        expect(formatHHMM(input)).toBe(expected);
    });
});
