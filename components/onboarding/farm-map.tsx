'use client';

// Client only: Leaflet needs `window`. Import this file with next/dynamic and { ssr: false }.
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Map as MapIcon, Maximize2, Minimize2, Satellite, WifiOff } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { REGION_CENTERS } from '@/constants/constituencies';
import { GHANA_CENTER, insideGhana } from '@/components/onboarding/onboarding-schemas';
import { cn } from '@/lib/utils';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Where to fly to (a searched place). A new `key` flies again, even to the same spot. */
export interface MapFocus extends LatLng {
  zoom: number;
  key: number;
}

type Basemap = 'map' | 'satellite';

/**
 * The pin: an emerald dot drawn with CSS (.farm-pin in globals.css). A divIcon with only a class
 * avoids Leaflet's default marker images, whose paths break under bundlers.
 */
const PIN = L.divIcon({ className: 'farm-pin', iconSize: [24, 24], iconAnchor: [12, 12] });

/** Panning stays around Ghana (a little margin so border farms are easy to reach). */
const GHANA_PAN_BOUNDS = L.latLngBounds([3.9, -3.9], [11.8, 1.9]);

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Moves the map: to the region when one is picked, to a searched place, and to the pin when
 * it is set from outside the map. Also re-measures the map when it is resized.
 */
function ViewController({
  region,
  value,
  focus,
  expanded,
}: {
  region?: string;
  value: LatLng | null;
  focus?: MapFocus | null;
  expanded: boolean;
}) {
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
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.8 });
  }, [map, focus]);
  useEffect(() => {
    if (value && !map.getBounds().contains([value.lat, value.lng]))
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 13));
  }, [map, value]);
  useEffect(() => {
    // The container changed size: let Leaflet load tiles for the new area.
    const timer = window.setTimeout(() => map.invalidateSize(), 220);
    return () => window.clearTimeout(timer);
  }, [map, expanded]);
  return null;
}

function ClickToPin({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

const overlayButton =
  'bg-bg-1/90 text-text border-border hover:bg-bg-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-lg backdrop-blur-sm transition-colors';

/**
 * OpenStreetMap with one draggable pin. Scroll (or pinch) to zoom in down to single fields,
 * drag to move around, switch to satellite to spot the farm itself, and enlarge the map.
 * Clicks outside Ghana are refused (onOutside). When tiles can't load (no internet), a message
 * replaces them; the step still works without a pin. With `interactive={false}` it is a small
 * static preview (review screen).
 */
export default function FarmMap({
  value,
  onChange,
  onOutside,
  region,
  focus,
  interactive = true,
  className,
}: {
  value: LatLng | null;
  onChange?: (value: LatLng) => void;
  onOutside?: () => void;
  region?: string;
  focus?: MapFocus | null;
  interactive?: boolean;
  className?: string;
}) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>('map');
  const [expanded, setExpanded] = useState(false);
  const center = value ?? (region ? REGION_CENTERS[region] : undefined) ?? GHANA_CENTER;
  const zoom = value ? 15 : region && REGION_CENTERS[region] ? 9 : 7;

  const pick = (point: LatLng) => {
    if (!insideGhana(point)) {
      onOutside?.();
      return;
    }
    onChange?.({ lat: round(point.lat), lng: round(point.lng) });
  };

  const tileEvents = {
    tileerror: () => setTilesFailed(true),
    tileload: () => setTilesFailed(false),
  };

  return (
    <div
      className={cn('relative transition-[height] duration-200', className)}
      // Larger map: most of the screen, so small villages and field edges are easy to find.
      style={expanded ? { height: 'min(75vh, 640px)' } : undefined}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={6}
        maxZoom={19}
        maxBounds={interactive ? GHANA_PAN_BOUNDS : undefined}
        maxBoundsViscosity={0.8}
        scrollWheelZoom={interactive}
        wheelPxPerZoomLevel={90}
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
        {basemap === 'map' ? (
          <TileLayer
            key="map"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            eventHandlers={tileEvents}
          />
        ) : (
          <>
            <TileLayer
              key="satellite"
              attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              maxNativeZoom={18}
              eventHandlers={tileEvents}
            />
            {/* Town and village names on top of the photo. */}
            <TileLayer
              key="labels"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              maxNativeZoom={18}
            />
          </>
        )}
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
        {interactive && (
          <ViewController region={region} value={value} focus={focus} expanded={expanded} />
        )}
      </MapContainer>

      {interactive && (
        <div className="absolute top-2.5 right-2.5 z-500 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => {
              setTilesFailed(false);
              setBasemap(basemap === 'map' ? 'satellite' : 'map');
            }}
            aria-pressed={basemap === 'satellite'}
            className={overlayButton}
          >
            {basemap === 'map' ? (
              <Satellite size={14} aria-hidden="true" />
            ) : (
              <MapIcon size={14} aria-hidden="true" />
            )}
            {basemap === 'map' ? 'Satellite' : 'Map'}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-pressed={expanded}
            className={overlayButton}
          >
            {expanded ? (
              <Minimize2 size={14} aria-hidden="true" />
            ) : (
              <Maximize2 size={14} aria-hidden="true" />
            )}
            {expanded ? 'Smaller' : 'Larger map'}
          </button>
        </div>
      )}

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
