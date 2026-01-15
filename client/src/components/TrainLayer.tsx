import React, { useEffect, useState, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface Train {
    id: string;
    route: string;
    lat: number;
    lon: number;
    heading: number;
    destination: string;
    lastUpdate: string;
    isMock?: boolean;
}

interface CTASnapshot {
    generatedAt: string;
    trains: Train[];
}

const POLL_INTERVAL = 5000; // Poll backend every 5s

// Route color mapping
const ROUTE_COLORS: Record<string, string> = {
    'red': '#c60c30',
    'blue': '#00a1de',
    'brn': '#62361b',
    'g': '#009b3a',
    'org': '#f9461c',
    'p': '#522398',
    'pnk': '#e27ea6',
    'y': '#f9e300',
    'pink': '#e27ea6',
    'purple': '#522398',
    'yellow': '#f9e300',
    'brown': '#62361b',
    'green': '#009b3a',
    'orange': '#f9461c'
};

const createTrainIcon = (route: string, heading: number) => {
    const routeName = (route || 'unknown').toLowerCase();
    // Use darker/richer colors if needed, but standard routing colors are usually fine.
    const color = ROUTE_COLORS[routeName] || '#FFFFFF';

    return L.divIcon({
        className: 'cta-train-marker',
        html: `
            <div style="
                transform: rotate(${heading}deg);
                width: 14px;
                height: 28px;
                background-color: ${color};
                border: 1.5px solid white;
                border-radius: 4px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.6);
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
            ">
                <!-- Front Windshield (Top) -->
                <div style="
                    width: 70%;
                    height: 20%;
                    background: rgba(255, 255, 255, 0.9);
                    margin-top: 2px;
                    border-radius: 2px;
                "></div>
                
                <!-- Headlights -->
                <div style="
                    position: absolute;
                    top: 1px;
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    padding: 0 2px;
                ">
                    <div style="width: 2px; height: 2px; background: #fff; border-radius: 50%; box-shadow: 0 0 2px white;"></div>
                    <div style="width: 2px; height: 2px; background: #fff; border-radius: 50%; box-shadow: 0 0 2px white;"></div>
                </div>

                <!-- Accordion / Joint (Middle detail) -->
                <div style="
                    width: 100%;
                    height: 1px;
                    background: rgba(0,0,0,0.2);
                    margin-top: auto;
                    margin-bottom: auto;
                "></div>
            </div>
        `,
        iconSize: [14, 28],
        iconAnchor: [7, 14]
    });
};

const AnimatedMarker = ({ train }: { train: Train }) => {
    const [position, setPosition] = useState<[number, number]>([train.lat, train.lon]);
    const requestRef = useRef<number>();
    const startTimeRef = useRef<number>();
    const startPosRef = useRef<[number, number]>([train.lat, train.lon]);
    const targetPosRef = useRef<[number, number]>([train.lat, train.lon]);

    // Update target when train prop changes
    useEffect(() => {
        // If target changed drastically (e.g. initial load or mockery reset), snap.
        // Otherwise interpolate. 
        // Here we always interpolate from current visual position to new target.
        startPosRef.current = position;
        targetPosRef.current = [train.lat, train.lon];
        startTimeRef.current = undefined; // Reset animation start

        const animate = (time: number) => {
            if (startTimeRef.current === undefined) startTimeRef.current = time;
            const progress = (time - startTimeRef.current) / POLL_INTERVAL; // 5s duration

            if (progress < 1) {
                const lat = startPosRef.current[0] + (targetPosRef.current[0] - startPosRef.current[0]) * progress;
                const lon = startPosRef.current[1] + (targetPosRef.current[1] - startPosRef.current[1]) * progress;
                setPosition([lat, lon]);
                requestRef.current = requestAnimationFrame(animate);
            } else {
                setPosition(targetPosRef.current);
            }
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [train.lat, train.lon, train.lastUpdate]); // Trigger on position update

    return (
        <Marker
            position={position}
            icon={createTrainIcon(train.route, train.heading)}
            zIndexOffset={100}
        >
            <Popup>
                <div className="text-sm">
                    <h3 className="font-bold uppercase" style={{ color: ROUTE_COLORS[(train.route || '').toLowerCase()] || '#fff' }}>{train.route} Line</h3>
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
        const fetchTrains = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/trains');
                if (!res.ok) return;
                const data: CTASnapshot = await res.json();
                if (data && Array.isArray(data.trains)) {
                    setTrains(data.trains);
                } else {
                    console.warn("Invalid train data format", data);
                    setTrains([]);
                }
            } catch (err) {
                console.error("Failed to fetch trains:", err);
            }
        };

        fetchTrains();
        const interval = setInterval(fetchTrains, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            {trains.map(train => (
                <AnimatedMarker key={train.id} train={train} />
            ))}
        </>
    );
};

export default TrainLayer;
