import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Location } from '../api/client';
import TrainLayer from './TrainLayer';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const CHICAGO_CENTER: [number, number] = [41.8781, -87.6298];

interface MapProps {
    locations: Location[];
    routeCoords?: [number, number][];
    onLocationSelect: (id: number) => void;
}

// Effect: 3D Tilt
const Map3DEffect = () => {
    const map = useMap();
    useEffect(() => {
        const pane = map.getPane('mapPane');
        if (pane) {
            pane.style.transform += ' translate3d(0,0,0) rotateX(10deg) scale(1.0)';
            pane.style.transformOrigin = 'center 80%';
            pane.style.transition = 'transform 0.8s ease-out';
        }
    }, [map]);
    return null;
};

// --- V8.2: DYNAMIC HEATMAP LOGIC ---
type HeatmapCluster = {
    lat: number;
    lng: number;
    intensity: number; // 0-1 range based on relative max
    color: string;
    radius: number;
}

const calculateHeatmaps = (locations: Location[]): HeatmapCluster[] => {
    if (!locations.length) return [];

    // 1. Grid Logic (approx 0.003 degrees ~ 1.5 blocks - tighter)
    const GRID_SIZE = 0.0035;
    const grid: Record<string, { lat: number, lng: number, score: number, types: Record<string, number> }> = {};

    // 2. Time Logic (Get current hour 0-23)
    const hour = new Date().getHours();
    const isNight = hour >= 18 || hour < 4; // 6PM - 4AM
    const isDay = hour >= 6 && hour < 18;

    locations.forEach(loc => {
        // Grid Key
        const gridLat = Math.floor(loc.latitude / GRID_SIZE);
        const gridLng = Math.floor(loc.longitude / GRID_SIZE);
        const key = `${gridLat},${gridLng}`;

        if (!grid[key]) {
            grid[key] = {
                lat: (gridLat * GRID_SIZE) + (GRID_SIZE / 2),
                lng: (gridLng * GRID_SIZE) + (GRID_SIZE / 2),
                score: 0,
                types: { night: 0, day: 0, food: 0 }
            };
        }

        const tags = loc.tags?.map(t => t.tag.name) || [];

        let pointScore = 1;

        // Multipliers based on Time
        const isNightlife = tags.some(t => ['Nightclub', 'Bar', 'Dance', 'High Energy', 'Drinks'].includes(t));
        const isDaytime = tags.some(t => ['Cafe', 'Coffee', 'Park', 'Museum', 'Breakfast'].includes(t));
        const isFood = tags.some(t => ['Restaurant', 'Dinner'].includes(t));

        if (isNight) {
            if (isNightlife) { pointScore = 3; grid[key].types.night++; }
            else if (isFood) { pointScore = 2; grid[key].types.food++; }
            else if (isDaytime) { pointScore = 0.5; grid[key].types.day++; }
        } else {
            // Day
            if (isDaytime) { pointScore = 3; grid[key].types.day++; }
            else if (isFood) { pointScore = 2; grid[key].types.food++; }
            else if (isNightlife) { pointScore = 0.5; grid[key].types.night++; }
        }

        grid[key].score += pointScore;
    });

    // 3. Convert to Clusters
    const clusters: HeatmapCluster[] = [];
    const scores = Object.values(grid).map(g => g.score);
    const maxScore = Math.max(...scores, 1);

    Object.values(grid).forEach(cell => {
        // Threshold: Only show if significant relative to max (or absolute score > 2)
        if (cell.score > 2) {
            const intensity = Math.min(cell.score / maxScore, 1);

            // Determine Color
            let color = '#FFBF00'; // Default Amber
            if (cell.types.night > cell.types.day && cell.types.night > cell.types.food) color = '#00F0FF'; // Cyan
            else if (cell.types.food > cell.types.night && cell.types.food > cell.types.day) color = '#FF0099'; // Pink
            else if (cell.types.day > cell.types.night) color = '#FFD700'; // Gold

            clusters.push({
                lat: cell.lat,
                lng: cell.lng,
                intensity,
                color,
                // V8.3: Tighter Radius (300m - 800m)
                radius: 300 + (intensity * 500)
            });
        }
    });

    return clusters;
};


const MapComponent: React.FC<MapProps> = ({ locations, routeCoords, onLocationSelect }) => {

    // --- V8: GTFS ROUTES ---
    type RouteData = {
        id: string;
        name: string;
        color: string;
        shapes: number[][][];
    };
    const [ctaRoutes, setCtaRoutes] = useState<RouteData[]>([]);

    useEffect(() => {
        const fetchRoutes = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/gtfs/routes');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) setCtaRoutes(data);
                }
            } catch (err) { console.error("Failed GTFS", err); }
        };
        fetchRoutes();
    }, []);

    // --- V8.2: DYNAMIC HEATMAPS ---
    const heatmapClusters = useMemo(() => calculateHeatmaps(locations), [locations]);

    // --- V8: SEMANTIC MARKER LOGIC ---
    // (Preserved from V8.1)
    type MarkerConfig = {
        color: string;
        shape: 'star' | 'circle' | 'diamond' | 'ring';
        pulseClass: string;
        size: number;
    }

    const getMarkerConfig = (loc: Location): MarkerConfig => {
        // 1. Dynamic Category Styling (Priority)
        if (loc.categories && loc.categories.length > 0) {
            // Pick first category for now. Better logic: pick "deepest" child or priority.
            // If multiple, maybe we prioritized them in assignment?
            const cat = loc.categories[0];
            return {
                color: (cat as any).color || '#ffffff',
                shape: ((cat as any).shape as 'star' | 'circle' | 'diamond' | 'ring') || 'circle',
                pulseClass: '', // Can add pulse logic later or via another field
                size: 24
            };
        }

        // 2. Fallback to Legacy Tag Logic
        const tags = loc.tags?.map(t => t.tag.name) || [];
        if (tags.some(t => ['Nightclub', 'Dance', 'High Energy'].includes(t))) return { color: '#00F0FF', shape: 'star', pulseClass: 'animate-pulse-fast', size: 32 };
        if (tags.some(t => ['Bar', 'Pub', 'Dive Bar', 'Chill'].includes(t))) return { color: '#FFBF00', shape: 'circle', pulseClass: 'animate-pulse-slow', size: 24 };
        if (tags.some(t => ['Rooftop', 'View'].includes(t))) return { color: '#3BFFFF', shape: 'ring', pulseClass: '', size: 28 };
        if (tags.some(t => ['Restaurant', 'Food', 'Trendy'].includes(t))) return { color: '#FF0099', shape: 'circle', pulseClass: 'animate-pulse-slow', size: 20 };
        if (tags.some(t => ['Hidden Gem', 'Speakeasy'].includes(t))) return { color: '#7A00FF', shape: 'diamond', pulseClass: 'animate-pulse-slow', size: 24 };
        return { color: '#ffffff', shape: 'circle', pulseClass: '', size: 16 };
    };

    const createV8Marker = (loc: Location) => {
        const config = getMarkerConfig(loc);
        const commonStyle = `
            background-color: ${config.shape === 'ring' ? 'transparent' : config.color};
            border: ${config.shape === 'ring' ? `3px solid ${config.color}` : '1px solid rgba(255,255,255,0.8)'};
            box-shadow: 0 0 10px ${config.color};
            width: 100%; height: 100%;
        `;
        let shapeTransform = config.shape === 'diamond' ? 'rotate(45deg)' : '';
        const starStyle = config.shape === 'star' ? `clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);` : '';

        return L.divIcon({
            className: 'v8-marker-container',
            html: `
                <div style="width: ${config.size}px; height: ${config.size}px; position: relative;">
                    ${config.pulseClass ? `<div class="${config.pulseClass}" style="position: absolute; inset: 0; background-color: ${config.color}; opacity: 0.5; border-radius: 50%; ${shapeTransform}"></div>` : ''}
                    <div style="${commonStyle} ${shapeTransform} ${starStyle} border-radius: ${config.shape === 'circle' || config.shape === 'ring' ? '50%' : '0'};"></div>
                </div>
            `,
            iconSize: [config.size, config.size],
            iconAnchor: [config.size / 2, config.size / 2]
        });
    };

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#111] perspective-[1000px]">
            <MapContainer center={CHICAGO_CENTER} zoom={13} scrollWheelZoom={true} className="h-full w-full bg-[#111]">
                <Map3DEffect />
                <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

                {/* --- V8.2: DYNAMIC HEATMAPS --- */}
                {heatmapClusters.map((cluster, idx) => (
                    <Circle
                        key={`heatmap-${idx}`}
                        center={[cluster.lat, cluster.lng]}
                        radius={cluster.radius}
                        pathOptions={{
                            color: 'transparent',
                            fillColor: cluster.color,
                            fillOpacity: 0.1 + (cluster.intensity * 0.2), // V8.3: Subtler (0.1 - 0.3)
                            className: 'vibe-zone-blur'
                        }}
                    />
                ))}

                {/* CTA Lines */}
                {ctaRoutes.map(line => (
                    <React.Fragment key={line.id}>
                        {line.shapes.map((shape, idx) => (
                            <Polyline key={`${line.id}-${idx}`} positions={shape as [number, number][]} pathOptions={{ color: line.color, weight: 3, opacity: 0.6, lineCap: 'round' }} />
                        ))}
                    </React.Fragment>
                ))}

                {/* Markers */}
                {locations.map(loc => (
                    <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={createV8Marker(loc)} eventHandlers={{ click: () => onLocationSelect(loc.id) }} />
                ))}

                {/* Route */}
                {routeCoords && routeCoords.length > 0 && <Polyline positions={routeCoords} pathOptions={{ color: '#FFD700', weight: 4 }} />}

                <TrainLayer />
            </MapContainer>
        </div>
    );
};

export default MapComponent;
