export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface GeocodedAddressResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
  cachedAt: number;
}

const GEOCODE_CACHE_STORAGE_KEY = 'myqueue_geocode_cache_v1';
// Per Google Maps Platform Service Specific Terms: cache lat/lng up to 30 consecutive calendar days max
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let memoryCache: Record<string, GeocodedAddressResult> | null = null;
let cachedServerApiKey: string | null = null;

export function parseMapCoordinates(coords?: string): LatLngPoint | null {
  if (!coords || typeof coords !== 'string') return null;
  const match = coords.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function normalizeAddressKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase();
}

function loadGeocodeCache(): Record<string, GeocodedAddressResult> {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_STORAGE_KEY);
    if (!raw) {
      memoryCache = {};
      return memoryCache;
    }
    const parsed = JSON.parse(raw) as Record<string, GeocodedAddressResult>;
    const now = Date.now();
    const fresh: Record<string, GeocodedAddressResult> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.lat === 'number' && typeof v.lng === 'number' && now - (v.cachedAt || 0) < MAX_CACHE_AGE_MS) {
        fresh[k] = v;
      }
    }
    memoryCache = fresh;
    return fresh;
  } catch {
    memoryCache = {};
    return memoryCache;
  }
}

function persistGeocodeCache(cache: Record<string, GeocodedAddressResult>) {
  memoryCache = cache;
  try {
    localStorage.setItem(GEOCODE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
}

export function getCachedGeocode(address: string): GeocodedAddressResult | null {
  const key = normalizeAddressKey(address);
  if (!key) return null;
  const cache = loadGeocodeCache();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt >= MAX_CACHE_AGE_MS) {
    delete cache[key];
    persistGeocodeCache(cache);
    return null;
  }
  return entry;
}

export async function geocodeAddress(
  address: string,
  options?: { forceRefresh?: boolean }
): Promise<{ result: GeocodedAddressResult | null; error?: string; quotaExceeded?: boolean }> {
  const cleanAddress = address.trim();
  if (!cleanAddress) {
    return { result: null };
  }

  if (!options?.forceRefresh) {
    const cached = getCachedGeocode(cleanAddress);
    if (cached) {
      return { result: cached };
    }
  }

  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: cleanAddress }),
    });

    const data = await res.json().catch(() => null);

    // Tier 2 Quota Detection (strictly check 429 or RESOURCE_EXHAUSTED / OVER_QUERY_LIMIT)
    if (
      res.status === 429 ||
      data?.error?.status === 'RESOURCE_EXHAUSTED' ||
      data?.status === 'OVER_QUERY_LIMIT'
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      return {
        result: null,
        quotaExceeded: true,
        error: data?.error?.message || 'Google Maps Platform quota exceeded',
      };
    }

    if (res.ok && data?.found && typeof data.lat === 'number' && typeof data.lng === 'number') {
      const entry: GeocodedAddressResult = {
        lat: data.lat,
        lng: data.lng,
        formattedAddress: data.formattedAddress || cleanAddress,
        placeId: data.placeId || undefined,
        cachedAt: Date.now(),
      };
      const cache = loadGeocodeCache();
      cache[normalizeAddressKey(cleanAddress)] = entry;
      persistGeocodeCache(cache);
      return { result: entry };
    }

    if (!res.ok) {
      return {
        result: null,
        error: data?.error?.message || 'ไม่สามารถค้นหาพิกัดจากที่อยู่นี้ได้',
      };
    }

    return { result: null };
  } catch (err: any) {
    return {
      result: null,
      error: err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อบริการค้นหาพิกัด',
    };
  }
}

export function haversineDistanceKm(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function resolveMapsApiKey(): Promise<string> {
  const clientEnvKey = (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    (import.meta.env as Record<string, string | undefined>).VITE_MAPS_API_KEY ||
    ''
  ).trim();

  if (clientEnvKey) {
    return clientEnvKey;
  }

  if (cachedServerApiKey !== null) {
    return cachedServerApiKey;
  }

  try {
    const res = await fetch('/api/maps/config');
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const serverKey = typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
      cachedServerApiKey = serverKey;
      return serverKey;
    }
  } catch {
    // ignore fetch failures
  }
  return '';
}
