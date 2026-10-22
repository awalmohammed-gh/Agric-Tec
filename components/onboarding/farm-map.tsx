'use client';

// Client only: Leaflet needs `window`. Import this file with next/dynamic and { ssr: false }.
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { WifiOff } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { REGION_CENTERS } from '@/constants/constituencies';
import { GHANA_CENTER, insideGhana } from '@/components/onboarding/onboarding-schemas';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * The pin: an emerald dot drawn with CSS (.farm-pin in globals.css). A divIcon with only a class
 * avoids Leaflet's default marker images, whose paths break under bundlers.
 */
const PIN = L.divIcon({ className: 'farm-pin', iconSize: [24, 24], iconAnchor: [12, 12] });

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** Zooms to the region when it changes, and to the pin when one is set from outside the map. */
function ViewController({ region, value }: { region?: string; value: LatLng | null }) {
  const map = useMap();
  // Only a region picked after the map opened moves it (the first view already fits the pin
  // or the region), so reopening a saved location never hides its pin.
  const shownRegion = useRef(region);
  useEffect(() => {
    if (region === shownRegion.current) return;
    shownRegion.current = region;
    const center = region ? REGION_CENTERS[region] : undefined;
    if (center) map.flyTo([center.lat, center.lng], 9, { duration: 0.6 });
  }, [map, region]);
  useEffect(() => {
    if (value && !map.getBounds().contains([value.lat, value.lng]))
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 12));
  }, [map, value]);
  return null;
}

function ClickToPin({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

/**
 * OpenStreetMap with one draggable pin. Clicks outside Ghana are refused (onOutside). When the
 * tiles can't load (no internet), a message replaces them; the step still works without a pin.
 * With `interactive={false}` it is a small static preview (review screen).
 */
export default function FarmMap({
  value,
  onChange,
  onOutside,
  region,
  interactive = true,
  className,
}: {
  value: LatLng | null;
  onChange?: (value: LatLng) => void;
  onOutside?: () => void;
  region?: string;
  interactive?: boolean;
  className?: string;
}) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const center = value ?? (region ? REGION_CENTERS[region] : undefined) ?? GHANA_CENTER;
  const zoom = value ? 13 : region && REGION_CENTERS[region] ? 9 : 7;

  const pick = (point: LatLng) => {
    if (!insideGhana(point)) {
      onOutside?.();
      return;
    }
    onChange?.({ lat: round(point.lat), lng: round(point.lng) });
  };

  return (
    <div className={className} style={{ position: 'relative' }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={6}
        scrollWheelZoom={false}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        boxZoom={interactive}
        attributionControl
        className="h-full w-full rounded-2xl"
        style={{ background: 'var(--bg-2)' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setTilesFailed(true),
            tileload: () => setTilesFailed(false),
          }}
        />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={PIN}
            draggable={interactive}
            keyboard={false}
            title="Your farm"
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as L.Marker;
                const point = marker.getLatLng();
                if (insideGhana(point)) pick(point);
                else {
                  // Snap back to the last valid spot.
                  marker.setLatLng([value.lat, value.lng]);
                  onOutside?.();
                }
              },
            }}
          />
        )}
        {interactive && <ClickToPin onPick={pick} />}
        {interactive && <ViewController region={region} value={value} />}
      </MapContainer>
      {tilesFailed && (
        <div
          role="status"
          className="bg-bg-2/90 text-text-dim absolute inset-0 z-500 flex flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center text-sm"
        >
          <WifiOff size={22} aria-hidden="true" className="text-text-mute" />
          <p className="text-text font-semibold">The map can&apos;t load right now</p>
          <p className="max-w-xs text-xs">
            Check your internet connection. You can still continue without a pin, or use your
            current location.
          </p>
        </div>
      )}
    </div>
  );
}
