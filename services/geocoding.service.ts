// Finds towns and villages in Ghana by name (OpenStreetMap's Nominatim: free, no API key).
// Its usage policy allows about one request a second, so the map searches on submit, never
// on every keystroke, and results are cached for the session.

import { z } from 'zod';

export interface PlaceResult {
  id: string;
  /** "Ejura" */
  name: string;
  /** "Ejura-Sekyedumase, Ashanti Region" */
  detail: string;
  lat: number;
  lng: number;
  /** A sensible zoom for this kind of place (a village needs a closer view than a district). */
  zoom: number;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const resultSchema = z.array(
  z.object({
    place_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    name: z.string().optional(),
    display_name: z.string(),
    addresstype: z.string().optional(),
    type: z.string().optional(),
  }),
);

/** Closer for small places, wider for districts and regions. */
function zoomFor(kind: string | undefined): number {
  switch (kind) {
    case 'hamlet':
    case 'isolated_dwelling':
    case 'farm':
    case 'neighbourhood':
    case 'locality':
      return 16;
    case 'village':
    case 'suburb':
      return 15;
    case 'town':
      return 14;
    case 'city':
      return 13;
    case 'county':
    case 'district':
    case 'municipality':
      return 11;
    case 'state':
    case 'region':
      return 9;
    default:
      return 14;
  }
}

const cache = new Map<string, PlaceResult[]>();

export const geocodingService = {
  /** Up to 6 places in Ghana matching the name. Throws when offline or the service fails. */
  async searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const key = q.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      countrycodes: 'gh',
      limit: '6',
      'accept-language': 'en',
    });
    const response = await fetch(`${ENDPOINT}?${params}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Place search is not available right now.');
    const parsed = resultSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Place search returned something unexpected.');

    const places = parsed.data
      .map((item) => {
        const parts = item.display_name.split(',').map((p) => p.trim());
        const name = item.name?.trim() || parts[0];
        return {
          id: String(item.place_id),
          name,
          // The rest of the address, without the name itself and "Ghana".
          detail: parts
            .filter((p, i) => !(i === 0 && p === name) && p !== 'Ghana')
            .slice(0, 3)
            .join(', '),
          lat: Number(item.lat),
          lng: Number(item.lon),
          zoom: zoomFor(item.addresstype ?? item.type),
        };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    cache.set(key, places);
    return places;
  },

  /**
   * Where a constituency is, to move the map there. Constituencies are usually named after
   * their main town ("Ejisu", "Tamale North", "Ejura-Sekyedumase"), so this looks up the full
   * name, then the town part. Null when neither is found (the map stays on the region).
   */
  async locateConstituency(
    constituency: string,
    region: string,
    signal?: AbortSignal,
  ): Promise<PlaceResult | null> {
    const town = constituency
      .replace(/\b(North|South|East|West|Central|Municipal)\b/g, '')
      .split(/[-/]/)[0]
      .trim();
    const queries = [constituency, ...(town && town !== constituency ? [town] : [])];
    for (const [index, name] of queries.entries()) {
      // Nominatim allows about one request a second: wait before a second try.
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1100));
      if (signal?.aborted) return null;
      const [first] = await geocodingService.searchPlaces(`${name}, ${region} Region`, signal);
      if (first) return { ...first, name: constituency, zoom: Math.min(first.zoom, 12) };
    }
    return null;
  },
};
