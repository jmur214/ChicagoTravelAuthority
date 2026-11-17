import type { TransportMode } from '@cta/shared';

export const TRANSPORT_OPTIONS: { mode: TransportMode; icon: string; label: string }[] = [
    { mode: 'walk', icon: '🚶', label: 'Walk' },
    { mode: 'transit', icon: '🚇', label: 'Transit' },
    { mode: 'drive', icon: '🚗', label: 'Rideshare' },
];

export const transportIcon = (mode: TransportMode) => TRANSPORT_OPTIONS.find(o => o.mode === mode)?.icon ?? '🚗';
