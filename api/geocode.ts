import { ApiRequest, ApiResponse } from './_store.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { status: 'INVALID_METHOD', message: 'Method Not Allowed' } });
  }

  try {
    const rawAddress = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
    if (!rawAddress || rawAddress.length > 500) {
      return res.status(400).json({
        found: false,
        error: { status: 'INVALID_ARGUMENT', message: 'Valid address string is required.' },
      });
    }

    const apiKey =
      (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

    if (!apiKey) {
      return res.status(503).json({
        found: false,
        error: { status: 'API_KEY_MISSING', message: 'Google Maps API key is not configured on server.' },
      });
    }

    // Primary: Google Maps Platform Geocoding API v4
    const v4Url = `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(rawAddress)}?regionCode=TH&languageCode=th`;
    const v4Resp = await fetch(v4Url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'results.placeId,results.location,results.formattedAddress,results.granularity',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
    });

    const v4Data = await v4Resp.json().catch(() => null);

    if (v4Resp.status === 429 || v4Data?.error?.status === 'RESOURCE_EXHAUSTED') {
      return res.status(429).json({
        found: false,
        error: { status: 'RESOURCE_EXHAUSTED', message: v4Data?.error?.message || 'Geocoding quota exceeded' },
      });
    }

    if (v4Resp.ok) {
      const first = v4Data?.results?.[0];
      const lat = first?.location?.latitude;
      const lng = first?.location?.longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return res.status(200).json({
          found: true,
          lat,
          lng,
          placeId: first.placeId || '',
          formattedAddress: first.formattedAddress || rawAddress,
          granularity: first.granularity || '',
        });
      }
      return res.status(200).json({ found: false, results: [] });
    }

    // Fallback to classic Geocoding REST endpoint if v4 API is disabled on the provisioned key
    const classicUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(rawAddress)}&region=th&language=th&key=${encodeURIComponent(apiKey)}`;
    const classicResp = await fetch(classicUrl, { method: 'GET' });
    const classicData = await classicResp.json().catch(() => null);

    if (classicResp.status === 429 || classicData?.status === 'OVER_QUERY_LIMIT') {
      return res.status(429).json({
        found: false,
        error: { status: 'RESOURCE_EXHAUSTED', message: classicData?.error_message || 'Geocoding quota exceeded' },
      });
    }

    if (classicData?.status === 'OK' && classicData?.results?.[0]?.geometry?.location) {
      const top = classicData.results[0];
      return res.status(200).json({
        found: true,
        lat: top.geometry.location.lat,
        lng: top.geometry.location.lng,
        placeId: top.place_id || '',
        formattedAddress: top.formatted_address || rawAddress,
        granularity: top.geometry.location_type || '',
      });
    }

    if (classicData?.status === 'ZERO_RESULTS') {
      return res.status(200).json({ found: false, results: [] });
    }

    return res.status(classicResp.ok ? 200 : classicResp.status).json({
      found: false,
      error: {
        status: classicData?.status || 'GEOCODE_ERROR',
        message: classicData?.error_message || v4Data?.error?.message || 'Unable to geocode address',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      found: false,
      error: { status: 'INTERNAL_ERROR', message: err?.message || 'Server error while geocoding address' },
    });
  }
}
