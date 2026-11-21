import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Compass,
  Flag,
  Landmark,
  LocateFixed,
  MapPin,
  Navigation,
  Play,
  RefreshCw,
  Route,
  Shuffle,
  Square,
  Trees,
  WifiOff,
} from 'lucide-react';
import { RunningRouteType } from '../types/rebuild';
import {
  computePathDistanceKm,
  CourseSpot,
  GeneratedCourse,
  generateSafeRunningCourse,
  haversineKm,
} from '../utils/runningCourse';

const COURSE_STORAGE_KEY = 'rebuild_active_course_v1';

interface PersistedCourseState {
  startCoord: [number, number] | null;
  routeType: RunningRouteType;
  courseVariantSeed: number;
  course: GeneratedCourse | null;
  actualTrack: [number, number][];
  clearedSpotIds: string[];
}

function loadPersistedCourse(): PersistedCourseState | null {
  try {
    const raw = localStorage.getItem(COURSE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCourseState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedCourse(state: PersistedCourseState): void {
  try {
    localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors silently
  }
}

interface RunningCourseMapProps {
  recommendedRunKm: number;
  savedDistanceKm?: number | null;
  initialRouteType?: RunningRouteType | null;
  completedToday: boolean;
  todayKey: string;
  onApplyRunResult: (
    km: number,
    routeType: RunningRouteType,
    toughPointsCleared: number,
    markCompletedToday?: boolean
  ) => void;
}

function makeBadgeIcon(label: string, bg: string, border: string, text: string = '#111214') {
  return L.divIcon({
    className: 'rebuild-map-pin',
    html: `<div style="background:${bg};color:${text};border:2px solid ${border};padding:2px 6px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.65);">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [18, 12],
  });
}

export const RunningCourseMap: React.FC<RunningCourseMapProps> = ({
  recommendedRunKm,
  savedDistanceKm,
  initialRouteType,
  completedToday,
  todayKey,
  onApplyRunResult,
}) => {
  const initialPersisted = useRef<PersistedCourseState | null>(loadPersistedCourse()).current;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const plannedLayerRef = useRef<L.Polyline | null>(null);
  const actualLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const gpsMarkerRef = useRef<L.CircleMarker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [routeType, setRouteType] = useState<RunningRouteType>(
    initialPersisted?.routeType ?? initialRouteType ?? 'round_trip'
  );
  // Start coordinate & course are hydrated from localStorage and NEVER reset on offline/re-render
  const [startCoord, setStartCoord] = useState<[number, number] | null>(
    initialPersisted?.startCoord ?? null
  );
  const [courseVariantSeed, setCourseVariantSeed] = useState<number>(
    initialPersisted?.courseVariantSeed ?? 0
  );
  const [course, setCourse] = useState<GeneratedCourse | null>(
    initialPersisted?.course ?? null
  );
  const [loadingCourse, setLoadingCourse] = useState(false);

  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [gpsStatus, setGpsStatus] = useState<string>(
    initialPersisted?.course
      ? '保存済みの現在地・安全コースを復元しました（再取得またはコース再考まで保持されます）。'
      : '「現在地を取得」または「手動スタート指定」で開始地点を設定すると、推奨距離の安全コースを固定描画します。'
  );
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [manualPickMode, setManualPickMode] = useState(false);

  const [isTracking, setIsTracking] = useState(false);
  const [actualTrack, setActualTrack] = useState<[number, number][]>(
    initialPersisted?.actualTrack ?? []
  );
  const [clearedSpotIds, setClearedSpotIds] = useState<string[]>(
    initialPersisted?.clearedSpotIds ?? []
  );
  const [activeEventSpot, setActiveEventSpot] = useState<CourseSpot | null>(null);
  const [simStepIdx, setSimStepIdx] = useState(0);

  // Time-to-distance fallback helper (minutes at 6:00/km pace)
  const [minutesInput, setMinutesInput] = useState('30');
  const [savedBanner, setSavedBanner] = useState(false);

  const manualPickRef = useRef(manualPickMode);
  manualPickRef.current = manualPickMode;

  // Persist course state immediately whenever it changes
  useEffect(() => {
    savePersistedCourse({
      startCoord,
      routeType,
      courseVariantSeed,
      course,
      actualTrack,
      clearedSpotIds,
    });
  }, [startCoord, routeType, courseVariantSeed, course, actualTrack, clearedSpotIds]);

  // Track online/offline status & refresh tiles seamlessly when back online
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      mapRef.current?.invalidateSize();
      tileLayerRef.current?.redraw();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Explicit helper to generate & lock a course ONLY on intentional user actions
  const triggerCourseGeneration = async (
    coord: [number, number],
    nextRouteType: RunningRouteType,
    nextSeed: number
  ) => {
    setLoadingCourse(true);
    setClearedSpotIds([]);
    setActiveEventSpot(null);
    setSimStepIdx(0);
    const generated = await generateSafeRunningCourse(
      coord,
      recommendedRunKm,
      nextRouteType,
      nextSeed
    );
    setCourse(generated);
    setLoadingCourse(false);
  };

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = startCoord ?? [36.2048, 138.2529];
    const initialZoom = startCoord ? 14 : 5;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
    });

    tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    plannedLayerRef.current = L.polyline([], {
      color: '#00F0FF',
      weight: 4,
      opacity: 0.9,
      dashArray: '8 6',
    }).addTo(map);
    actualLayerRef.current = L.polyline([], {
      color: '#CCFF00',
      weight: 5,
      opacity: 1,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!manualPickRef.current) return;
      const picked: [number, number] = [e.latlng.lat, e.latlng.lng];
      setStartCoord(picked);
      setActualTrack([]);
      setManualPickMode(false);
      setGpsError(null);
      setGpsStatus('指定した地点にスタートを固定し、安全コースを生成しました。');
      triggerCourseGeneration(picked, routeType, courseVariantSeed);
    });

    mapRef.current = map;

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render planned course polyline & markers onto Leaflet
  useEffect(() => {
    const map = mapRef.current;
    const plannedLayer = plannedLayerRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !plannedLayer || !markersLayer) return;

    if (!course) {
      plannedLayer.setLatLngs([]);
      markersLayer.clearLayers();
      return;
    }

    plannedLayer.setLatLngs(course.coordinates);
    markersLayer.clearLayers();

    // Start marker
    L.marker(course.coordinates[0], {
      icon: makeBadgeIcon('START', '#FFFFFF', '#CCFF00', '#111214'),
    })
      .bindPopup('スタート地点（固定）')
      .addTo(markersLayer);

    // Course spots (landmark, scenic, monument, tough, turnaround, goal)
    course.spots.forEach((spot) => {
      const isCleared = clearedSpotIds.includes(spot.id);
      let icon: L.DivIcon;
      if (spot.type === 'tough') {
        icon = makeBadgeIcon(
          isCleared ? '✓ 突破!' : '⚠️ きつい',
          isCleared ? '#CCFF00' : '#FF3B30',
          '#FFFFFF',
          isCleared ? '#111214' : '#FFFFFF'
        );
      } else if (spot.type === 'turnaround') {
        icon = makeBadgeIcon('折り返し', '#FFD600', '#111214', '#111214');
      } else if (spot.type === 'goal') {
        icon = makeBadgeIcon('🏁 GOAL', '#CCFF00', '#111214', '#111214');
      } else if (spot.type === 'monument') {
        icon = makeBadgeIcon(
          isCleared ? '✓ 銅像' : '🗿 銅像',
          '#00F0FF',
          '#111214',
          '#111214'
        );
      } else if (spot.type === 'landmark') {
        icon = makeBadgeIcon(
          isCleared ? '✓ 観光' : '🏛️ 観光',
          '#00F0FF',
          '#111214',
          '#111214'
        );
      } else {
        icon = makeBadgeIcon(
          isCleared ? '✓ 景色' : '🌳 景色',
          '#00F0FF',
          '#111214',
          '#111214'
        );
      }

      const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(markersLayer);
      marker.bindPopup(`<strong>${spot.name}</strong><br/>${spot.note}`);
      marker.on('click', () => setActiveEventSpot(spot));
    });

    if (course.coordinates.length > 1) {
      map.fitBounds(plannedLayer.getBounds(), { padding: [26, 26] });
    }
  }, [course, clearedSpotIds]);

  // Render actual GPS track polyline & current position marker
  useEffect(() => {
    const map = mapRef.current;
    const actualLayer = actualLayerRef.current;
    if (!map || !actualLayer) return;

    actualLayer.setLatLngs(actualTrack);

    if (actualTrack.length > 0) {
      const latest = actualTrack[actualTrack.length - 1];
      if (!gpsMarkerRef.current) {
        gpsMarkerRef.current = L.circleMarker(latest, {
          radius: 7,
          color: '#111214',
          weight: 2,
          fillColor: '#CCFF00',
          fillOpacity: 1,
        }).addTo(map);
      } else {
        gpsMarkerRef.current.setLatLng(latest);
      }
    }
  }, [actualTrack]);

  const evaluateSpotProximity = (pos: [number, number]) => {
    if (!course) return;
    course.spots.forEach((spot) => {
      const dist = haversineKm(pos, [spot.lat, spot.lng]);
      if (dist <= 0.15) {
        setClearedSpotIds((prev) => (prev.includes(spot.id) ? prev : [...prev, spot.id]));
        setActiveEventSpot(spot);
      }
    });
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError(
        startCoord
          ? 'GPSが利用できないため、保存済みの現在地・コースをそのまま維持します。'
          : 'このブラウザはGPS位置情報に対応していません。「手動スタート指定」または距離入力をご利用ください。'
      );
      return;
    }
    setGpsError(null);
    setGpsStatus('現在地を取得中...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setStartCoord(next);
        setActualTrack([next]);
        setGpsStatus('現在地を固定し、安全コースを描画しました（再取得またはコース再考まで保持します）。');
        triggerCourseGeneration(next, routeType, courseVariantSeed);
      },
      () => {
        // NEVER overwrite or reset existing startCoord/course on GPS failure or offline
        setGpsError(
          startCoord
            ? '現在地の再取得に失敗しました。保存済みのスタート地点・コースをそのまま維持します。'
            : '位置情報の許可が得られないか取得に失敗しました。「手動スタート指定」から地図をタップして開始地点を選ぶか、距離入力をご利用ください。'
        );
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleToggleTracking = () => {
    if (isTracking) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      setGpsStatus('GPSトラッキングを停止しました。走行距離をログに反映できます。');
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('GPSが利用できないため、「手動スタート指定」または距離入力をご利用ください。');
      return;
    }

    setGpsError(null);
    setIsTracking(true);
    if (startCoord) {
      setActualTrack((prev) => (prev.length > 0 ? prev : [startCoord]));
    }
    setGpsStatus('GPSトラッキング中… 固定された計画ルートに対して実走行軌跡を黄緑ラインで描画します。');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setStartCoord((prev) => {
          if (prev) return prev;
          triggerCourseGeneration(next, routeType, courseVariantSeed);
          return next;
        });
        setActualTrack((prev) => [...prev, next]);
        evaluateSpotProximity(next);
      },
      () => {
        setGpsError(
          startCoord
            ? 'GPS信号が一時的に途切れました。保存済みのコース・軌跡は保持されています。'
            : 'GPS信号の取得に失敗しました。手動スタート指定または距離入力をご利用ください。'
        );
        setIsTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
  };

  const handleSwitchRouteType = (nextType: RunningRouteType) => {
    setRouteType(nextType);
    if (startCoord) {
      setActualTrack([]);
      triggerCourseGeneration(startCoord, nextType, courseVariantSeed);
    }
  };

  const handleReconsiderCourse = () => {
    if (!startCoord) return;
    const nextSeed = courseVariantSeed + 1;
    setCourseVariantSeed(nextSeed);
    setActualTrack([]);
    setGpsStatus('別の方角・経由地で新しい安全コースを再生成しました。');
    triggerCourseGeneration(startCoord, routeType, nextSeed);
  };

  const handleSimulateStep = () => {
    if (!course || course.coordinates.length < 2) return;
    const nextIdx = Math.min(
      course.coordinates.length - 1,
      simStepIdx + Math.ceil(course.coordinates.length / 5)
    );
    const sliced = course.coordinates.slice(0, nextIdx + 1);
    setActualTrack(sliced);
    setSimStepIdx(nextIdx);
    const latest = sliced[sliced.length - 1];
    evaluateSpotProximity(latest);
  };

  const trackedKm = computePathDistanceKm(actualTrack);
  const toughClearedCount =
    course?.spots.filter((s) => s.type === 'tough' && clearedSpotIds.includes(s.id)).length ?? 0;
  const plannedKm = course?.plannedDistanceKm ?? Math.max(1.0, recommendedRunKm);
  const remainingKm = Math.max(0, Math.round((plannedKm - trackedKm) * 10) / 10);

  const parsedMinutes = parseFloat(minutesInput);
  const convertedKmFromTime =
    !Number.isNaN(parsedMinutes) && parsedMinutes > 0
      ? Math.round((parsedMinutes / 6) * 10) / 10
      : 0;

  const courseCompletionKm = trackedKm >= 0.1 ? trackedKm : plannedKm;
  const effectiveRunKm = trackedKm >= 0.1 ? trackedKm : savedDistanceKm ?? 0;
  const isPlannedGoalMet = effectiveRunKm >= plannedKm;

  const commitDistance = (km: number, markCompletedToday: boolean = false) => {
    if (km <= 0) return;
    if (markCompletedToday && completedToday) return;
    onApplyRunResult(km, routeType, toughClearedCount, markCompletedToday);
    setSavedBanner(true);
    window.setTimeout(() => setSavedBanner(false), 2200);
  };

  return (
    <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3 max-w-full overflow-hidden">
      {/* Header + Route Type Selector (往復 / 片道) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-[#CCFF00]" />
          <h3 className="text-sm font-extrabold text-white tracking-wide">
            GPS安全コース＆スポットナビ
          </h3>
          {isOffline && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FFD600]/15 border border-[#FFD600]/40 text-[10px] font-bold text-[#FFD600]">
              <WifiOff className="w-3 h-3" />
              オフライン保持中
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg border border-[#2C2F36]">
          <button
            type="button"
            onClick={() => handleSwitchRouteType('round_trip')}
            className={`px-2.5 py-1 rounded text-[11px] font-extrabold transition-colors cursor-pointer ${
              routeType === 'round_trip'
                ? 'bg-[#CCFF00] text-black'
                : 'text-[#8E929B] hover:text-white'
            }`}
          >
            往復
          </button>
          <button
            type="button"
            onClick={() => handleSwitchRouteType('one_way')}
            className={`px-2.5 py-1 rounded text-[11px] font-extrabold transition-colors cursor-pointer ${
              routeType === 'one_way'
                ? 'bg-[#CCFF00] text-black'
                : 'text-[#8E929B] hover:text-white'
            }`}
          >
            片道
          </button>
        </div>
      </div>

      {/* GPS, Course Reconsider & Manual Start Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111214] border border-[#2C2F36] text-[11px] font-bold text-white hover:border-[#CCFF00]/60 cursor-pointer"
        >
          <LocateFixed className="w-3.5 h-3.5 text-[#CCFF00]" />
          <span>{startCoord ? '現在地を再取得' : '現在地を取得'}</span>
        </button>

        {startCoord && (
          <button
            type="button"
            onClick={handleReconsiderCourse}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111214] border border-[#00F0FF]/50 text-[11px] font-extrabold text-[#00F0FF] hover:bg-[#00F0FF]/10 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>コース再考</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleToggleTracking}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-extrabold cursor-pointer ${
            isTracking
              ? 'bg-[#FF3B30]/20 border-[#FF3B30] text-[#FF3B30]'
              : 'bg-[#CCFF00]/15 border-[#CCFF00]/50 text-[#CCFF00]'
          }`}
        >
          {isTracking ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          <span>{isTracking ? 'GPS停止' : 'GPSトラッキング開始'}</span>
        </button>

        <button
          type="button"
          onClick={() => setManualPickMode((v) => !v)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
            manualPickMode
              ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF]'
              : 'bg-[#111214] border-[#2C2F36] text-[#8E929B] hover:text-white'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{manualPickMode ? '地図をタップして決定' : '手動スタート指定'}</span>
        </button>

        {course && (
          <button
            type="button"
            onClick={handleSimulateStep}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111214] border border-[#2C2F36] text-[11px] font-bold text-[#8E929B] hover:text-white cursor-pointer"
            title="コース上のスポット通過・きついポイント達成をプレビュー"
          >
            <Navigation className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>通過デモ</span>
          </button>
        )}
      </div>

      {gpsError ? (
        <div className="rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/40 px-3 py-2 text-[11px] text-[#FF8A80]">
          {gpsError}
        </div>
      ) : (
        <p className="text-[11px] text-[#8E929B]">{gpsStatus}</p>
      )}

      {/* Leaflet Map */}
      <div className="relative rounded-xl overflow-hidden border border-[#2C2F36] bg-[#111214]">
        <div ref={mapContainerRef} className="w-full h-64 sm:h-72 z-0" />
        {!startCoord && (
          <div className="absolute bottom-2.5 inset-x-2.5 z-10 px-3 py-2 rounded-lg bg-[#111214]/90 border border-[#2C2F36] text-[11px] text-[#D1D5DB] text-center pointer-events-none">
            「現在地を取得」または「手動スタート指定」で地図をタップして開始地点を設定してください
          </div>
        )}
        {loadingCourse && (
          <div className="absolute top-2 right-2 z-10 px-2.5 py-1 rounded-lg bg-[#111214]/90 border border-[#2C2F36] text-[10px] font-bold text-[#CCFF00] flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>ルート・標高解析中...</span>
          </div>
        )}
      </div>

      {/* Route Stats: Planned vs Actual Track & Remaining */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[#111214] border border-[#2C2F36] p-2">
          <div className="text-[10px] text-[#8E929B] font-bold">
            計画ルート（{routeType === 'round_trip' ? '往復' : '片道'}）
          </div>
          <div className="font-mono-athletic text-sm font-black text-[#00F0FF] mt-0.5">
            {plannedKm.toFixed(1)} km
          </div>
        </div>
        <div className="rounded-xl bg-[#111214] border border-[#2C2F36] p-2">
          <div className="text-[10px] text-[#8E929B] font-bold">GPS走行実績</div>
          <div className="font-mono-athletic text-sm font-black text-[#CCFF00] mt-0.5">
            {trackedKm.toFixed(1)} km
          </div>
        </div>
        <div className="rounded-xl bg-[#111214] border border-[#2C2F36] p-2">
          <div className="text-[10px] text-[#8E929B] font-bold">ゴールまで残り</div>
          <div className="font-mono-athletic text-sm font-black text-white mt-0.5">
            {remainingKm.toFixed(1)} km
          </div>
        </div>
      </div>

      {/* Active Spot / Tough Point Event Banner */}
      {activeEventSpot && (
        <div
          className={`rounded-xl border p-3 flex items-start gap-2.5 ${
            activeEventSpot.type === 'tough'
              ? 'bg-[#FF3B30]/12 border-[#FF3B30]/50'
              : activeEventSpot.type === 'goal'
              ? 'bg-[#CCFF00]/15 border-[#CCFF00]/60'
              : 'bg-[#00F0FF]/10 border-[#00F0FF]/40'
          }`}
        >
          {activeEventSpot.type === 'tough' ? (
            <AlertTriangle className="w-4 h-4 text-[#FF3B30] shrink-0 mt-0.5" />
          ) : activeEventSpot.type === 'goal' ? (
            <Flag className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
          ) : activeEventSpot.type === 'turnaround' ? (
            <Compass className="w-4 h-4 text-[#FFD600] shrink-0 mt-0.5" />
          ) : activeEventSpot.type === 'landmark' || activeEventSpot.type === 'monument' ? (
            <Landmark className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5" />
          ) : (
            <Trees className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-white">{activeEventSpot.name}</span>
              {activeEventSpot.type === 'tough' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#CCFF00] text-black text-[10px] font-extrabold shrink-0">
                  <Award className="w-3 h-3" />
                  +ボーナス
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#D1D5DB] mt-0.5">{activeEventSpot.note}</p>
          </div>
        </div>
      )}

      {/* Course Spots List */}
      {course && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#8E929B]">
            <span>コース上のスポット・きついポイント（タップで詳細表示）</span>
            {course.elevationGainM > 0 && (
              <span className="font-mono-athletic text-[#CCFF00]">
                獲得標高 +{course.elevationGainM}m
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {course.spots.map((spot) => {
              const cleared = clearedSpotIds.includes(spot.id);
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => setActiveEventSpot(spot)}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11px] cursor-pointer transition-colors ${
                    cleared
                      ? 'bg-[#CCFF00]/10 border-[#CCFF00]/50 text-white'
                      : spot.type === 'tough'
                      ? 'bg-[#FF3B30]/10 border-[#FF3B30]/35 text-white'
                      : 'bg-[#111214] border-[#2C2F36] text-[#D1D5DB] hover:border-[#00F0FF]/50'
                  }`}
                >
                  <span className="truncate font-bold">{spot.name}</span>
                  <span className="font-mono-athletic text-[10px] text-[#8E929B] shrink-0">
                    {spot.distanceKmFromStart.toFixed(1)}km {cleared ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Time-Converted Save + Once-Per-JST-Day Course Complete Button */}
      <div className="space-y-2.5 pt-2 border-t border-[#2C2F36]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-[#8E929B]">時間換算:</span>
            <input
              type="number"
              min="1"
              max="180"
              value={minutesInput}
              onChange={(e) => setMinutesInput(e.target.value)}
              className="w-14 px-2 py-1 rounded bg-[#111214] border border-[#2C2F36] font-mono-athletic text-white text-center"
            />
            <span className="text-[#8E929B]">分 ≒</span>
            <strong className="font-mono-athletic text-[#CCFF00]">{convertedKmFromTime.toFixed(1)} km</strong>
          </div>

          <button
            type="button"
            onClick={() => commitDistance(convertedKmFromTime, false)}
            className="px-3 py-1.5 rounded-lg bg-[#111214] border border-[#2C2F36] text-white hover:border-[#CCFF00]/60 font-bold text-[11px] cursor-pointer"
          >
            {savedBanner
              ? 'ログに反映しました!'
              : `換算距離 (${convertedKmFromTime.toFixed(1)}km) を反映`}
          </button>
        </div>

        {/* Once-per-JST-day Complete & Confirm Button */}
        {completedToday ? (
          <div className="w-full rounded-xl bg-[#CCFF00]/15 border border-[#CCFF00]/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#CCFF00]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                本日のランニング達成済み（JST {todayKey.slice(5)} ・ 1日1回）
              </span>
            </div>
            <span className="font-mono-athletic text-xs font-black text-white">
              実績: {(savedDistanceKm ?? courseCompletionKm).toFixed(1)} km
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => commitDistance(courseCompletionKm, true)}
            className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isPlannedGoalMet
                ? 'bg-[#CCFF00] text-black shadow-[0_0_20px_rgba(204,255,0,0.35)] hover:brightness-105'
                : 'bg-[#2C2F36] text-white border border-[#3A3E47] hover:border-[#CCFF00]/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isPlannedGoalMet
                ? `計画距離達成！完了して記録 (実績: ${effectiveRunKm.toFixed(1)}km)`
                : `完了（記録を確定） (実績: ${courseCompletionKm.toFixed(1)}km)`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
