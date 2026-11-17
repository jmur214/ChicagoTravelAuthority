import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Train } from '@cta/shared';
import { api } from '../api/client';

/** How often to poll the API; also the duration of each position tween. */
const POLL_INTERVAL_MS = 5000;

/** CTA route codes (and long names) -> official line colors. */
const ROUTE_COLORS: Record<string, string> = {
    red: '#c60c30',
    blue: '#00a1de',
    brn: '#62361b', brown: '#62361b',
    g: '#009b3a', green: '#009b3a',
    org: '#f9461c', orange: '#f9461c',
    p: '#522398', purple: '#522398',
    pnk: '#e27ea6', pink: '#e27ea6',
    y: '#f9e300', yellow: '#f9e300',
};

const routeColor = (route: string) => ROUTE_COLORS[(route || '').toLowerCase()] ?? '#FFFFFF';

const createTrainIcon = (route: string, heading: number) =>
    L.divIcon({
        className: 'cta-train-marker',
        html: `
            <div style="transform: rotate(${heading}deg); width: 14px; height: 28px; background-color: ${routeColor(route)};
                border: 1.5px solid white; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.6);
                position: relative; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 70%; height: 20%; background: rgba(255,255,255,0.9); margin-top: 2px; border-radius: 2px;"></div>
                <div style="position: absolute; top: 1px; width: 100%; display: flex; justify-content: space-between; padding: 0 2px;">
                    <div style="width: 2px; height: 2px; background: #fff; border-radius: 50%; box-shadow: 0 0 2px white;"></div>
                    <div style="width: 2px; height: 2px; background: #fff; border-radius: 50%; box-shadow: 0 0 2px white;"></div>
                </div>
                <div style="width: 100%; height: 1px; background: rgba(0,0,0,0.2); margin: auto 0;"></div>
            </div>`,
        iconSize: [14, 28],
        iconAnchor: [7, 14],
    });

/** Smoothly tweens a train from its last drawn position to each new reported position. */
const AnimatedTrain: React.FC<{ train: Train }> = ({ train }) => {
    const [position, setPosition] = useState<[number, number]>([train.lat, train.lon]);
    // The position currently drawn, readable inside the effect without re-triggering it.
    const drawnRef = useRef<[number, number]>([train.lat, train.lon]);
    const icon = useMemo(() => createTrainIcon(train.route, train.heading), [train.route, train.heading]);

    useEffect(() => {
        const from = drawnRef.current;
        const to: [number, number] = [train.lat, train.lon];
        let start: number | undefined;
        let frame = 0;

        const step = (time: number) => {
            start ??= time;
            const t = Math.min((time - start) / POLL_INTERVAL_MS, 1);
            const next: [number, number] = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
            drawnRef.current = next;
            setPosition(next);
            if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [train.lat, train.lon]);

    return (
        <Marker position={position} icon={icon} zIndexOffset={100}>
            <Popup>
                <div className="text-sm">
                    <h3 className="font-bold uppercase" style={{ color: routeColor(train.route) }}>{train.route} Line</h3>
                    <p><strong>Dest:</strong> {train.destination}</p>
                    <p><strong>Run:</strong> {train.id}</p>
                    {train.isMock && <p className="text-xs text-gray-400 italic">Mock Data</p>}
                </div>
            </Popup>
        </Marker>
    );
};

const TrainLayer: React.FC = () => {
    const [trains, setTrains] = useState<Train[]>([]);

    useEffect(() => {
        let cancelled = false;
        const poll = () =>
            api.transit.trains().then(
                snapshot => !cancelled && setTrains(snapshot.trains),
                err => console.warn('Train poll failed:', err),
            );
        poll();
        const interval = setInterval(poll, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    return (
        <>
            {trains.map(train => (
                <AnimatedTrain key={train.id} train={train} />
            ))}
        </>
    );
};

export default TrainLayer;
