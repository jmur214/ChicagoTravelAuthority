import React, { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { CHICAGO_CENTER, type Location, type TransitRoute } from '@cta/shared';
import { api } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { calculateHeatmaps } from '../lib/heatmap';
import { getMarkerConfig, markerHtml } from '../lib/markers';
import TrainLayer from './TrainLayer';

interface MapProps {
    locations: Location[];
    routeCoords?: [number, number][];
    onLocationSelect: (id: number) => void;
}

const CENTER: [number, number] = [CHICAGO_CENTER.lat, CHICAGO_CENTER.lng];

/** Slight perspective tilt on the map pane. */
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

const createLocationIcon = (loc: Location) => {
    const config = getMarkerConfig(loc);
    return L.divIcon({
        className: 'v8-marker-container',
        html: markerHtml(config),
        iconSize: [config.size, config.size],
        iconAnchor: [config.size / 2, config.size / 2],
    });
};

const TransitLines: React.FC<{ routes: TransitRoute[] }> = ({ routes }) => (
    <>
        {routes.flatMap(line =>
            line.shapes.map((shape, idx) => (
                <Polyline
                    key={`${line.id}-${idx}`}
                    positions={shape}
                    pathOptions={{ color: line.color, weight: 3, opacity: 0.6, lineCap: 'round' }}
                />
            )),
        )}
    </>
);

const MapComponent: React.FC<MapProps> = ({ locations, routeCoords, onLocationSelect }) => {
    const { data: transitRoutes = [] } = useApiData(api.transit.routes);
    const heatmapClusters = useMemo(() => calculateHeatmaps(locations), [locations]);
    const markers = useMemo(() => locations.map(loc => ({ loc, icon: createLocationIcon(loc) })), [locations]);

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#111] perspective-[1000px]">
            <MapContainer center={CENTER} zoom={13} scrollWheelZoom className="h-full w-full bg-[#111]">
                <Map3DEffect />
                <TileLayer attribution="&copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

                {heatmapClusters.map(cluster => (
                    <Circle
                        key={`heat-${cluster.lat}-${cluster.lng}`}
                        center={[cluster.lat, cluster.lng]}
                        radius={cluster.radius}
                        pathOptions={{
                            color: 'transparent',
                            fillColor: cluster.color,
                            fillOpacity: 0.1 + cluster.intensity * 0.2,
                            className: 'vibe-zone-blur',
                        }}
                    />
                ))}

                <TransitLines routes={transitRoutes} />

                {markers.map(({ loc, icon }) => (
                    <Marker
                        key={loc.id}
                        position={[loc.latitude, loc.longitude]}
                        icon={icon}
                        eventHandlers={{ click: () => onLocationSelect(loc.id) }}
                    />
                ))}

                {routeCoords && routeCoords.length > 0 && (
                    <Polyline positions={routeCoords} pathOptions={{ color: '#FFD700', weight: 4 }} />
                )}

                <TrainLayer />
            </MapContainer>
        </div>
    );
};

export default MapComponent;
