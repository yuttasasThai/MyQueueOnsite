import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  AdvancedMarkerRef,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  LocateFixed,
  Navigation,
  Phone,
  Clock,
  RefreshCw,
  AlertCircle,
  Compass,
  Maximize2,
  Eye,
  Plus,
  LocateOff,
  Search,
} from 'lucide-react';
import { RepairJob, RepairStatus } from '../types';
import {
  LatLngPoint,
  parseMapCoordinates,
  geocodeAddress,
  getCachedGeocode,
  haversineDistanceKm,
  resolveMapsApiKey,
} from '../services/geocoding';
import { formatCustomerPhone, hasCustomerPhone } from '../services/smsNotify';

interface JobsMapViewProps {
  jobs: RepairJob[];
  onSelectJob: (job: RepairJob) => void;
  onOpenNewJob: () => void;
}

type PendingFilter = 'all' | 'today' | 'active_queue' | 'in_progress' | 'repaired';

interface ResolvedJobLocation {
  job: RepairJob;
  position: LatLngPoint;
  source: 'coordinates' | 'geocoded';
  formattedAddress: string;
}

const DEFAULT_BANGKOK_CENTER: LatLngPoint = { lat: 13.7563, lng: 100.5018 };

const STATUS_PIN_COLORS: Record<
  RepairStatus,
  { bg: string; border: string; ring: string; badgeText: string; label: string }
> = {
  รับงาน: {
    bg: '#2563eb',
    border: '#1d4ed8',
    ring: 'rgba(37,99,235,0.22)',
    badgeText: 'text-blue-700',
    label: 'รับงาน',
  },
  กำลังไป: {
    bg: '#d97706',
    border: '#b45309',
    ring: 'rgba(217,119,6,0.22)',
    badgeText: 'text-amber-700',
    label: 'กำลังไป',
  },
  กำลังซ่อม: {
    bg: '#7c3aed',
    border: '#6d28d9',
    ring: 'rgba(124,58,237,0.22)',
    badgeText: 'text-purple-700',
    label: 'กำลังซ่อม',
  },
  ซ่อมแล้ว: {
    bg: '#0d9488',
    border: '#0f766e',
    ring: 'rgba(13,148,136,0.22)',
    badgeText: 'text-teal-700',
    label: 'ซ่อมแล้ว',
  },
  นัดหมายต่อ: {
    bg: '#ea580c',
    border: '#c2410c',
    ring: 'rgba(234,88,12,0.22)',
    badgeText: 'text-orange-700',
    label: 'นัดหมายต่อ',
  },
  ปิดงาน: {
    bg: '#16a34a',
    border: '#15803d',
    ring: 'rgba(22,163,74,0.22)',
    badgeText: 'text-emerald-700',
    label: 'ปิดงาน',
  },
  ยกเลิก: {
    bg: '#64748b',
    border: '#475569',
    ring: 'rgba(100,116,139,0.22)',
    badgeText: 'text-slate-600',
    label: 'ยกเลิก',
  },
};

const Z_INDEX_SELECTED = 1000;
const Z_INDEX_HOVER = 999;

interface JobPinMarkerProps {
  item: ResolvedJobLocation;
  zIndex: number;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (jobId: string, marker: AdvancedMarkerRef) => void;
  onHover: (jobId: string | null) => void;
  registerMarkerRef: (jobId: string, marker: AdvancedMarkerRef) => void;
}

const JobPinMarker: React.FC<JobPinMarkerProps> = ({
  item,
  zIndex,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  registerMarkerRef,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const style = STATUS_PIN_COLORS[item.job.status] || STATUS_PIN_COLORS['รับงาน'];

  useEffect(() => {
    registerMarkerRef(item.job.id, marker);
    return () => registerMarkerRef(item.job.id, null);
  }, [item.job.id, marker, registerMarkerRef]);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={item.position}
      zIndex={zIndex}
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
      title={`${item.job.queueNumber} · ${item.job.customer.name} (${item.job.status})`}
      onClick={() => onSelect(item.job.id, marker)}
    >
      <div
        onMouseEnter={() => onHover(item.job.id)}
        onMouseLeave={() => onHover(null)}
        className="flex flex-col items-center cursor-pointer select-none transition-transform duration-150"
        style={{
          transform: isSelected ? 'scale(1.14)' : isHovered ? 'scale(1.07)' : 'scale(1)',
        }}
      >
        <div
          className="px-2 py-1 rounded-lg text-white font-mono text-[11px] font-bold shadow-md flex items-center gap-1 whitespace-nowrap border-2"
          style={{
            backgroundColor: style.bg,
            borderColor: isSelected ? '#0f172a' : '#ffffff',
            boxShadow: isSelected
              ? `0 0 0 4px ${style.ring}, 0 6px 14px rgba(15,23,42,0.28)`
              : '0 4px 10px rgba(15,23,42,0.22)',
          }}
        >
          <span>{item.job.queueNumber}</span>
        </div>
        <div
          className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[7px] -mt-[1px]"
          style={{ borderTopColor: isSelected ? '#0f172a' : '#ffffff' }}
        />
      </div>
    </AdvancedMarker>
  );
};

interface MapViewportControllerProps {
  pointsToFit: LatLngPoint[];
  fitRequestTick: number;
  focusTarget: { point: LatLngPoint; tick: number } | null;
}

const MapViewportController: React.FC<MapViewportControllerProps> = ({
  pointsToFit,
  fitRequestTick,
  focusTarget,
}) => {
  const map = useMap();
  const coreLib = useMapsLibrary('core');
  const didInitialFitRef = useRef(false);

  useEffect(() => {
    if (!map || pointsToFit.length === 0) return;
    if (didInitialFitRef.current && fitRequestTick === 0) return;

    if (pointsToFit.length === 1) {
      map.panTo(pointsToFit[0]);
      map.setZoom(14);
    } else if (coreLib?.LatLngBounds) {
      const bounds = new coreLib.LatLngBounds();
      for (const pt of pointsToFit) {
        bounds.extend(pt);
      }
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
    }
    didInitialFitRef.current = true;
  }, [map, coreLib, pointsToFit, fitRequestTick]);

  useEffect(() => {
    if (!map || !focusTarget) return;
    map.panTo(focusTarget.point);
    const currentZoom = map.getZoom();
    if (typeof currentZoom === 'number' && currentZoom < 14) {
      map.setZoom(15);
    }
  }, [map, focusTarget]);

  return null;
};

interface MapLoadStatusOverlayProps {
  hasKey: boolean;
}

const MapLoadStatusOverlay: React.FC<MapLoadStatusOverlayProps> = ({ hasKey }) => {
  const status = useApiLoadingStatus();

  if (!hasKey) return null;

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="absolute inset-0 z-20 bg-slate-50/95 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
        <p className="text-sm font-semibold text-slate-900">
          ไม่สามารถโหลด Google Maps ได้ในขณะนี้
        </p>
        <p className="text-xs text-slate-600 mt-1 max-w-md">
          กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือการตั้งค่า API Key ของแผนที่
        </p>
      </div>
    );
  }

  if (status === APILoadingStatus.LOADING) {
    return (
      <div className="absolute inset-0 z-10 bg-slate-100/90 flex flex-col items-center justify-center gap-2 text-slate-600">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs font-medium">กำลังโหลดแผนที่ Google Maps...</span>
      </div>
    );
  }

  return null;
};

export const JobsMapView: React.FC<JobsMapViewProps> = ({
  jobs,
  onSelectJob,
  onOpenNewJob,
}) => {
  const [mapsApiKey, setMapsApiKey] = useState<string>('');
  const [isKeyChecked, setIsKeyChecked] = useState(false);

  const [filterMode, setFilterMode] = useState<PendingFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortByDistance, setSortByDistance] = useState(true);

  // Browser Geolocation state (explicit & revocable)
  const [geoStatus, setGeoStatus] = useState<
    'idle' | 'locating' | 'granted' | 'denied' | 'unsupported'
  >('idle');
  const [userLocation, setUserLocation] = useState<(LatLngPoint & { accuracy?: number }) | null>(
    null
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(true);

  // Geocoded coordinates dictionary (avoid JS Map constructor shadowing)
  const [geocodedByKey, setGeocodedByKey] = useState<
    Record<string, { lat: number; lng: number; formattedAddress: string; status: 'ok' | 'failed' }>
  >({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });

  // Interactive marker / InfoWindow state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<AdvancedMarkerRef>(null);
  const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
  const markerInstancesRef = useRef<Record<string, AdvancedMarkerRef>>({});

  // Camera fit & pan triggers
  const [fitRequestTick, setFitRequestTick] = useState(0);
  const [focusTarget, setFocusTarget] = useState<{ point: LatLngPoint; tick: number } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Load Maps API key on mount
  useEffect(() => {
    let active = true;
    resolveMapsApiKey().then((key) => {
      if (active) {
        setMapsApiKey(key);
        setIsKeyChecked(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Request Browser Geolocation
  const requestUserLocation = useCallback((centerAfterLocate = false) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      setGeoError('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง (Geolocation API)');
      return;
    }

    setLocationTrackingEnabled(true);
    setGeoStatus('locating');
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
        };
        setUserLocation(pt);
        setGeoStatus('granted');
        setGeoError(null);
        if (centerAfterLocate) {
          setFocusTarget({ point: { lat: pt.lat, lng: pt.lng }, tick: Date.now() });
        }
      },
      (err) => {
        setGeoStatus('denied');
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('ไม่ได้รับอนุญาตเข้าถึงตำแหน่ง GPS กรุณาอนุญาตในเบราว์เซอร์เพื่อคำนวณระยะทาง');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError('ไม่สามารถระบุตำแหน่งปัจจุบันได้ในขณะนี้');
        } else {
          setGeoError('หมดเวลาค้นหาตำแหน่งปัจจุบัน กรุณาลองใหม่อีกครั้ง');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const handleRevokeLocation = useCallback(() => {
    setLocationTrackingEnabled(false);
    setUserLocation(null);
    setGeoStatus('idle');
    setGeoError(null);
  }, []);

  useEffect(() => {
    if (locationTrackingEnabled) {
      requestUserLocation(false);
    }
  }, [locationTrackingEnabled, requestUserLocation]);

  // All pending jobs (not closed and not cancelled)
  const pendingJobs = useMemo(() => {
    return jobs.filter((j) => j.status !== 'ปิดงาน' && j.status !== 'ยกเลิก');
  }, [jobs]);

  const filteredPendingJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pendingJobs.filter((job) => {
      if (filterMode === 'today' && job.appointmentDate !== todayStr) return false;
      if (
        filterMode === 'active_queue' &&
        job.status !== 'รับงาน' &&
        job.status !== 'กำลังไป' &&
        job.status !== 'นัดหมายต่อ'
      ) {
        return false;
      }
      if (filterMode === 'in_progress' && job.status !== 'กำลังซ่อม') return false;
      if (filterMode === 'repaired' && job.status !== 'ซ่อมแล้ว') return false;

      if (!q) return true;
      return (
        job.queueNumber.toLowerCase().includes(q) ||
        job.product.toLowerCase().includes(q) ||
        job.customer.name.toLowerCase().includes(q) ||
        job.customer.address.toLowerCase().includes(q) ||
        job.customer.phone.includes(q)
      );
    });
  }, [pendingJobs, filterMode, searchQuery, todayStr]);

  // Resolve coordinates for pending jobs (from explicit coordinates or geocoded address)
  const geocodeMissingPendingAddresses = useCallback(
    async (forceRefresh = false) => {
      const candidates = pendingJobs.filter((job) => {
        const hasAddress = Boolean(job.customer.address && job.customer.address.trim());
        if (!hasAddress) return false;
        if (!forceRefresh && parseMapCoordinates(job.customer.mapCoordinates)) return false;

        const addrKey = `${job.id}::${job.customer.address.trim()}`;
        if (!forceRefresh && geocodedByKey[addrKey]) return false;

        if (!forceRefresh) {
          const cached = getCachedGeocode(job.customer.address);
          if (cached) return false;
        }
        return true;
      });

      if (candidates.length === 0) return;

      setIsGeocoding(true);
      setGeocodeProgress({ done: 0, total: candidates.length });

      let completed = 0;
      for (const job of candidates) {
        const cleanAddr = job.customer.address.trim();
        const addrKey = `${job.id}::${cleanAddr}`;
        const { result, quotaExceeded } = await geocodeAddress(cleanAddr, { forceRefresh });

        setGeocodedByKey((prev) => ({
          ...prev,
          [addrKey]: result
            ? {
                lat: result.lat,
                lng: result.lng,
                formattedAddress: result.formattedAddress,
                status: 'ok',
              }
            : {
                lat: 0,
                lng: 0,
                formattedAddress: cleanAddr,
                status: 'failed',
              },
        }));

        completed += 1;
        setGeocodeProgress({ done: completed, total: candidates.length });

        if (quotaExceeded) {
          break;
        }
      }

      setIsGeocoding(false);
    },
    [pendingJobs, geocodedByKey]
  );

  // Hydrate cached addresses immediately and trigger geocoding for uncached addresses
  useEffect(() => {
    const initialHydrated: Record<
      string,
      { lat: number; lng: number; formattedAddress: string; status: 'ok' | 'failed' }
    > = {};
    let hasNewCacheHits = false;

    for (const job of pendingJobs) {
      const cleanAddr = (job.customer.address || '').trim();
      if (!cleanAddr) continue;
      const addrKey = `${job.id}::${cleanAddr}`;
      if (geocodedByKey[addrKey]) continue;

      const cached = getCachedGeocode(cleanAddr);
      if (cached) {
        initialHydrated[addrKey] = {
          lat: cached.lat,
          lng: cached.lng,
          formattedAddress: cached.formattedAddress,
          status: 'ok',
        };
        hasNewCacheHits = true;
      }
    }

    if (hasNewCacheHits) {
      setGeocodedByKey((prev) => ({ ...prev, ...initialHydrated }));
    }
  }, [pendingJobs, geocodedByKey]);

  useEffect(() => {
    geocodeMissingPendingAddresses(false);
  }, [geocodeMissingPendingAddresses]);

  const { resolvedJobs, unresolvedJobs } = useMemo(() => {
    const resolved: ResolvedJobLocation[] = [];
    const unresolved: RepairJob[] = [];

    for (const job of filteredPendingJobs) {
      const cleanAddr = (job.customer.address || '').trim();
      const addrKey = `${job.id}::${cleanAddr}`;
      const geocoded = cleanAddr ? geocodedByKey[addrKey] : undefined;
      const directCoords = parseMapCoordinates(job.customer.mapCoordinates);

      if (geocoded && geocoded.status === 'ok') {
        resolved.push({
          job,
          position: { lat: geocoded.lat, lng: geocoded.lng },
          source: 'geocoded',
          formattedAddress: geocoded.formattedAddress || cleanAddr,
        });
      } else if (directCoords) {
        resolved.push({
          job,
          position: directCoords,
          source: 'coordinates',
          formattedAddress: cleanAddr || `${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)}`,
        });
      } else {
        unresolved.push(job);
      }
    }

    // Visual Z-Index depth: sort descending latitude first so southern markers sit naturally in front
    const sortedForMapAndList = [...resolved].sort((a, b) => {
      if (sortByDistance && userLocation) {
        return (
          haversineDistanceKm(userLocation, a.position) -
          haversineDistanceKm(userLocation, b.position)
        );
      }
      return (a.job.appointmentDate || '').localeCompare(b.job.appointmentDate || '');
    });

    return { resolvedJobs: sortedForMapAndList, unresolvedJobs: unresolved };
  }, [filteredPendingJobs, geocodedByKey, sortByDistance, userLocation]);

  // Latitude-sorted array solely for marker zIndex ordering
  const markersOrderedByLat = useMemo(() => {
    return [...resolvedJobs]
      .sort((a, b) => b.position.lat - a.position.lat)
      .map((item, idx) => ({ item, baseZ: idx + 1 }));
  }, [resolvedJobs]);

  const pointsToFit = useMemo(() => {
    const pts: LatLngPoint[] = resolvedJobs.map((r) => r.position);
    if (userLocation) {
      pts.push({ lat: userLocation.lat, lng: userLocation.lng });
    }
    return pts;
  }, [resolvedJobs, userLocation]);

  const registerMarkerRef = useCallback(
    (jobId: string, marker: AdvancedMarkerRef) => {
      markerInstancesRef.current[jobId] = marker;
    },
    []
  );

  const handleMarkerSelect = useCallback(
    (jobId: string, marker: AdvancedMarkerRef) => {
      setSelectedJobId(jobId);
      setSelectedMarker(marker || markerInstancesRef.current[jobId] || null);
    },
    []
  );

  const handleSidebarJobClick = useCallback((resolvedItem: ResolvedJobLocation) => {
    setSelectedJobId(resolvedItem.job.id);
    setSelectedMarker(markerInstancesRef.current[resolvedItem.job.id] || null);
    setFocusTarget({ point: resolvedItem.position, tick: Date.now() });
  }, []);

  const selectedResolvedItem = useMemo(
    () => resolvedJobs.find((r) => r.job.id === selectedJobId) || null,
    [resolvedJobs, selectedJobId]
  );

  const buildDirectionsHref = (item: ResolvedJobLocation) => {
    const dest = `${item.position.lat},${item.position.lng}`;
    const originParam = userLocation
      ? `&origin=${encodeURIComponent(`${userLocation.lat},${userLocation.lng}`)}`
      : '';
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(dest)}`;
  };

  const mapInitialCenter = useMemo(() => {
    if (userLocation) return { lat: userLocation.lat, lng: userLocation.lng };
    if (resolvedJobs.length > 0) return resolvedJobs[0].position;
    return DEFAULT_BANGKOK_CENTER;
  }, [userLocation, resolvedJobs]);

  return (
    <div className="space-y-4">
      {/* Header & Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              แผนที่คิวงานซ่อมที่รอดำเนินการ
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 tabular-nums">
              งานค้างทั้งหมด {pendingJobs.length} คิว · ปักหมุดบนแผนที่ {resolvedJobs.length} จุด
              {unresolvedJobs.length > 0 && ` · ไม่มีพิกัด/ที่อยู่ ${unresolvedJobs.length} คิว`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {locationTrackingEnabled ? (
              <button
                type="button"
                onClick={() => requestUserLocation(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LocateFixed className={`w-4 h-4 ${geoStatus === 'locating' ? 'animate-spin' : ''}`} />
                <span>{geoStatus === 'locating' ? 'กำลังค้นหาตำแหน่ง...' : 'ตำแหน่งของฉัน'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => requestUserLocation(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LocateFixed className="w-4 h-4" />
                <span>เปิดใช้งานตำแหน่ง GPS</span>
              </button>
            )}

            {userLocation && (
              <button
                type="button"
                onClick={handleRevokeLocation}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="หยุดการใช้ตำแหน่ง GPS ชั่วคราว"
              >
                <LocateOff className="w-3.5 h-3.5" />
                <span>ปิดพิกัด</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setFitRequestTick((t) => t + 1)}
              disabled={pointsToFit.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>แสดงหมุดทั้งหมด</span>
            </button>

            <button
              type="button"
              onClick={() => geocodeMissingPendingAddresses(true)}
              disabled={isGeocoding || pendingJobs.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="แปลงที่อยู่ลูกค้าเป็นพิกัดแผนที่ใหม่"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeocoding ? 'animate-spin text-blue-600' : ''}`} />
              <span>
                {isGeocoding
                  ? `กำลังปักหมุด (${geocodeProgress.done}/${geocodeProgress.total})`
                  : 'อัปเดตพิกัดจากที่อยู่'}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Bar + Geolocation Info Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
            {[
              { id: 'all' as PendingFilter, label: 'งานค้างทั้งหมด' },
              { id: 'today' as PendingFilter, label: 'นัดหมายวันนี้' },
              { id: 'active_queue' as PendingFilter, label: 'รับงาน / กำลังไป' },
              { id: 'in_progress' as PendingFilter, label: 'กำลังซ่อม' },
              { id: 'repaired' as PendingFilter, label: 'ซ่อมแล้ว' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterMode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 md:max-w-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเลขคิว ชื่อลูกค้า ที่อยู่..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            {userLocation && (
              <button
                type="button"
                onClick={() => setSortByDistance((s) => !s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sortByDistance
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {sortByDistance ? 'เรียงใกล้ฉันที่สุด' : 'เรียงตามวันนัด'}
              </button>
            )}
          </div>
        </div>

        {/* Geolocation Status Notice */}
        {(geoError || userLocation) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 text-slate-600">
            {geoError ? (
              <div className="flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg w-full">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="flex-1">{geoError}</span>
                <button
                  type="button"
                  onClick={() => requestUserLocation(true)}
                  className="font-semibold underline hover:text-amber-950 whitespace-nowrap cursor-pointer"
                >
                  ลองใหม่
                </button>
              </div>
            ) : userLocation ? (
              <div className="flex items-center gap-2 text-slate-600 tabular-nums">
                <Compass className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  ตำแหน่งปัจจุบันของท่าน: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                  {userLocation.accuracy ? ` · ความแม่นยำ ~${userLocation.accuracy} ม.` : ''}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Main 2-Column Split: Map Canvas + Pending Jobs Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left/Main Column: Interactive Google Map */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="relative w-full h-[440px] sm:h-[520px] lg:h-[620px] bg-slate-100">
            {!isKeyChecked ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">กำลังเตรียมระบบแผนที่...</span>
              </div>
            ) : !mapsApiKey ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-50">
                <MapPin className="w-10 h-10 text-slate-400 mb-3" />
                <h3 className="text-sm font-semibold text-slate-900">
                  ยังไม่ได้ตั้งค่า Google Maps API Key
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  กรุณาเชื่อมต่อ Google Maps API Key เพื่อแสดงผลแผนที่แบบอินเทอร์แอคทีฟและแปลงที่อยู่เป็นพิกัด
                </p>
              </div>
            ) : (
              <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="th" region="TH">
                <MapLoadStatusOverlay hasKey={Boolean(mapsApiKey)} />
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={mapInitialCenter}
                  defaultZoom={12}
                  gestureHandling="greedy"
                  mapTypeControl={false}
                  streetViewControl={false}
                  fullscreenControl={true}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                  onClick={() => setSelectedJobId(null)}
                >
                  <MapViewportController
                    pointsToFit={pointsToFit}
                    fitRequestTick={fitRequestTick}
                    focusTarget={focusTarget}
                  />

                  {/* Current User Geolocation Marker */}
                  {userLocation && (
                    <AdvancedMarker
                      position={{ lat: userLocation.lat, lng: userLocation.lng }}
                      zIndex={1100}
                      title="ตำแหน่งปัจจุบันของคุณ"
                      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                    >
                      <div className="relative flex items-center justify-center w-7 h-7">
                        <span className="absolute inset-0 rounded-full bg-blue-500/25 border border-blue-500/40" />
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-md" />
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* Pending Repair Job Pins */}
                  {markersOrderedByLat.map(({ item, baseZ }) => {
                    const isSelected = selectedJobId === item.job.id;
                    const isHovered = hoveredJobId === item.job.id;
                    const zIndex = isSelected ? Z_INDEX_SELECTED : isHovered ? Z_INDEX_HOVER : baseZ;

                    return (
                      <JobPinMarker
                        key={item.job.id}
                        item={item}
                        zIndex={zIndex}
                        isSelected={isSelected}
                        isHovered={isHovered}
                        onSelect={handleMarkerSelect}
                        onHover={setHoveredJobId}
                        registerMarkerRef={registerMarkerRef}
                      />
                    );
                  })}

                  {/* Anchored InfoWindow for Selected Pending Job */}
                  {selectedResolvedItem && selectedMarker && (
                    <InfoWindow
                      anchor={selectedMarker}
                      maxWidth={300}
                      onCloseClick={() => {
                        setSelectedJobId(null);
                        setSelectedMarker(null);
                      }}
                    >
                      <div className="p-1 space-y-2 text-slate-900 font-['Prompt',sans-serif] min-w-[220px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {selectedResolvedItem.job.queueNumber}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              STATUS_PIN_COLORS[selectedResolvedItem.job.status]?.badgeText ||
                              'text-slate-700'
                            }`}
                          >
                            {selectedResolvedItem.job.status}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-900 leading-snug">
                          {selectedResolvedItem.job.product}
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div>
                            ลูกค้า: <strong className="text-slate-800">{selectedResolvedItem.job.customer.name}</strong>
                          </div>
                          <div>
                            โทร:{' '}
                            {hasCustomerPhone(selectedResolvedItem.job.customer) ? (
                              <a
                                href={`tel:${selectedResolvedItem.job.customer.phone}`}
                                className="text-blue-600 hover:underline font-mono"
                              >
                                {selectedResolvedItem.job.customer.phone}
                              </a>
                            ) : (
                              <span className="text-slate-400">ไม่มีเบอร์</span>
                            )}
                          </div>
                          <div className="text-slate-500 leading-relaxed">
                            {selectedResolvedItem.formattedAddress}
                          </div>
                          <div className="text-slate-500 tabular-nums">
                            นัดหมาย: {selectedResolvedItem.job.appointmentDate} ·{' '}
                            {selectedResolvedItem.job.appointmentTime}
                          </div>
                          {userLocation && (
                            <div className="text-blue-700 font-medium tabular-nums">
                              ระยะห่างโดยประมาณ{' '}
                              {haversineDistanceKm(
                                userLocation,
                                selectedResolvedItem.position
                              ).toFixed(1)}{' '}
                              กม.
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => onSelectJob(selectedResolvedItem.job)}
                            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-medium cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>รายละเอียด</span>
                          </button>
                          <a
                            href={buildDirectionsHref(selectedResolvedItem)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>นำทาง</span>
                          </a>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>
            )}
          </div>

          {/* Legend & Google Maps Terms Footer Strip */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              {(['รับงาน', 'กำลังไป', 'กำลังซ่อม', 'ซ่อมแล้ว', 'นัดหมายต่อ'] as RepairStatus[]).map(
                (st) => (
                  <span key={st} className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_PIN_COLORS[st].bg }}
                    />
                    <span>{st}</span>
                  </span>
                )
              )}
              {userLocation && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-200 shrink-0" />
                  <span>ตำแหน่งของคุณ</span>
                </span>
              )}
            </div>

            <div className="text-[10px] text-slate-500">
              <span>Google Maps </span>
              <a
                href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-800"
              >
                Terms
              </a>
              <span> · </span>
              <a
                href="https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-800"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Pending Jobs List */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 flex flex-col lg:h-[662px] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <h3 className="text-sm font-semibold text-slate-900">
              คิวงานที่รอดำเนินการ ({filteredPendingJobs.length})
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              ปักหมุดแล้ว {resolvedJobs.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {filteredPendingJobs.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">ไม่มีคิวงานค้างในตัวกรองนี้</p>
                  <p className="text-xs text-slate-500">
                    สร้างคิวงานซ่อมใหม่พร้อมระบุที่อยู่ลูกค้าเพื่อแสดงหมุดบนแผนที่
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenNewJob}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>สร้างคิวงานใหม่</span>
                </button>
              </div>
            ) : (
              <>
                {resolvedJobs.map((item) => {
                  const isSelected = selectedJobId === item.job.id;
                  const distKm = userLocation
                    ? haversineDistanceKm(userLocation, item.position)
                    : null;
                  const stStyle = STATUS_PIN_COLORS[item.job.status];

                  return (
                    <div
                      key={item.job.id}
                      onClick={() => handleSidebarJobClick(item)}
                      className={`p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs min-w-0">
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {item.job.queueNumber}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className={`font-semibold ${stStyle?.badgeText || 'text-slate-700'}`}>
                            {item.job.status}
                          </span>
                        </div>

                        {distKm !== null && (
                          <span className="text-xs font-medium text-blue-700 tabular-nums shrink-0">
                            {distKm.toFixed(1)} กม.
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-slate-900 line-clamp-1">
                        {item.job.product}
                      </div>

                      <div className="text-[11px] text-slate-600">
                        {item.job.customer.name}
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span
                          className={`font-mono tabular-nums ${
                            hasCustomerPhone(item.job.customer) ? '' : 'text-slate-400'
                          }`}
                        >
                          {formatCustomerPhone(item.job.customer)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {item.formattedAddress}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {item.job.appointmentDate} · {item.job.appointmentTime}
                          </span>
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectJob(item.job);
                            }}
                            className="text-slate-700 hover:text-slate-950 font-medium underline cursor-pointer"
                          >
                            รายละเอียด
                          </button>
                          <a
                            href={buildDirectionsHref(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>นำทาง</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Unresolved / Missing Address Jobs Section */}
                {unresolvedJobs.length > 0 && (
                  <div className="p-3.5 bg-slate-50/80 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">
                      คิวงานที่ยังไม่มีพิกัดบนแผนที่ ({unresolvedJobs.length})
                    </div>
                    <div className="space-y-2">
                      {unresolvedJobs.map((job) => (
                        <div
                          key={job.id}
                          onClick={() => onSelectJob(job)}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 cursor-pointer space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-slate-900">
                              {job.queueNumber} · {job.status}
                            </span>
                            <span className="text-[11px] text-blue-600 font-medium">
                              เปิดแก้ไขที่อยู่
                            </span>
                          </div>
                          <div className="text-xs text-slate-800 truncate">{job.product}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {job.customer.address
                              ? `ไม่พบพิกัด: ${job.customer.address}`
                              : 'ยังไม่ได้ระบุที่อยู่หน้างาน'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
