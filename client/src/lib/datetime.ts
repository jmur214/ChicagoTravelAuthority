export { formatTimeInZone as formatClockTime, toZonedWallTime, zonedWallTimeToDate } from '@cta/shared';

export const priceLabel = (avgCost: number | null | undefined) => (avgCost ? '$'.repeat(avgCost) : '—');
