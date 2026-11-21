import { RunningRouteType } from '../types/rebuild';

export type CoursePointType =
  | 'shrine'
  | 'monument'
  | 'building'
  | 'checkpoint'
  | 'tough'
  | 'turnaround'
  | 'goal';

export interface CourseSpot {
  id: string;
  type: CoursePointType;
  categoryLabel: string;
  name: string;
  note: string;
  lat: number;
  lng: number;
  distanceKmFromStart: number;
}

export interface GeneratedCourse {
  routeType: RunningRouteType;
  variantSeed: number;
  targetDistanceKm: number;
  plannedDistanceKm: number;
  elevationGainM: number;
  coordinates: [number, number][];
  spots: CourseSpot[];
  source: 'osrm' | 'safe-fallback';
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computePathDistanceKm(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i - 1], coords[i]);
  }
  return Math.round(total * 100) / 100;
}

export function offsetCoord(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceKm: number
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const brng = toRad(bearingDeg);
  const d = distanceKm / EARTH_RADIUS_KM;
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [toDeg(lat2), toDeg(lng2)];
}

function getCoordAtFraction(
  coords: [number, number][],
  fraction: number
): { coord: [number, number]; distanceKm: number } {
  if (coords.length === 0) return { coord: [0, 0], distanceKm: 0 };
  if (coords.length === 1) return { coord: coords[0], distanceKm: 0 };

  const total = computePathDistanceKm(coords);
  const target = Math.max(0, Math.min(total, total * fraction));
  let acc = 0;

  for (let i = 1; i < coords.length; i++) {
    const seg = haversineKm(coords[i - 1], coords[i]);
    if (acc + seg >= target && seg > 0) {
      const ratio = (target - acc) / seg;
      const lat = coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * ratio;
      const lng = coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * ratio;
      return { coord: [lat, lng], distanceKm: Math.round(target * 10) / 10 };
    }
    acc += seg;
  }

  return { coord: coords[coords.length - 1], distanceKm: Math.round(total * 10) / 10 };
}

function buildFallbackCoordinates(
  start: [number, number],
  targetKm: number,
  routeType: RunningRouteType,
  variantSeed: number
): [number, number][] {
  const [lat0, lng0] = start;
  const steps = 16;
  const baseBearing = (35 + variantSeed * 73) % 360;
  const dirSign = variantSeed % 2 === 0 ? 1 : -1;

  if (routeType === 'round_trip') {
    // Outbound path + DIFFERENT return road/loop back to the exact start point
    const halfKm = targetKm / 2;
    const rawCoords: [number, number][] = [start];

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sway = Math.sin(t * Math.PI) * 26 * dirSign;
      rawCoords.push(offsetCoord(lat0, lng0, baseBearing + sway, halfKm * t));
    }

    const turnaround = rawCoords[rawCoords.length - 1];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Distinct return arc on the opposite side so outbound and return use different paths
      const returnSway = Math.sin(t * Math.PI) * 32 * dirSign;
      const backBearing = baseBearing + 180 + returnSway;
      rawCoords.push(offsetCoord(turnaround[0], turnaround[1], backBearing, halfKm * t));
    }
    rawCoords[rawCoords.length - 1] = start;

    const rawTotal = computePathDistanceKm(rawCoords);
    if (rawTotal > 0.05) {
      const scale = targetKm / rawTotal;
      return rawCoords.map(([la, lo]) => [
        lat0 + (la - lat0) * scale,
        lng0 + (lo - lng0) * scale,
      ]);
    }
    return rawCoords;
  }

  // One-way gentle scenic curve rotated by variantSeed
  const rawCoords: [number, number][] = [start];
  for (let i = 1; i <= steps * 2; i++) {
    const t = i / (steps * 2);
    const sway = Math.sin(t * Math.PI * 1.5) * 20 * dirSign;
    rawCoords.push(offsetCoord(lat0, lng0, baseBearing + sway, targetKm * t));
  }
  const rawTotal = computePathDistanceKm(rawCoords);
  if (rawTotal > 0.05) {
    const scale = targetKm / rawTotal;
    return rawCoords.map(([la, lo]) => [
      lat0 + (la - lat0) * scale,
      lng0 + (lo - lng0) * scale,
    ]);
  }
  return rawCoords;
}

interface OverpassPoi {
  lat: number;
  lng: number;
  name: string;
  type: 'shrine' | 'monument' | 'building';
  categoryLabel: '神社' | '石碑' | '建築物';
}

async function fetchNearbyOverpassPois(
  center: [number, number],
  radiusM: number
): Promise<OverpassPoi[]> {
  try {
    const controller = new AbortController();
    const tid = window.setTimeout(() => controller.abort(), 3200);
    const r = Math.min(2500, Math.max(600, Math.round(radiusM)));
    const query = `[out:json][timeout:3];(nwr["amenity"="place_of_worship"]["religion"="shinto"]["name"](around:${r},${center[0]},${center[1]});nwr["historic"="shrine"]["name"](around:${r},${center[0]},${center[1]});nwr["historic"~"monument|memorial|stone"]["name"](around:${r},${center[0]},${center[1]});nwr["historic"~"castle|building"]["name"](around:${r},${center[0]},${center[1]});nwr["tourism"~"museum|attraction"]["name"](around:${r},${center[0]},${center[1]}););out center 16;`;
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { signal: controller.signal }
    );
    window.clearTimeout(tid);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      elements?: {
        lat?: number;
        lon?: number;
        center?: { lat?: number; lon?: number };
        tags?: Record<string, string>;
      }[];
    };
    const pois: OverpassPoi[] = [];
    const seenNames = new Set<string>();
    for (const el of data.elements ?? []) {
      const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
      const lng = typeof el.lon === 'number' ? el.lon : el.center?.lon;
      const name = el.tags?.name;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !name || seenNames.has(name)) {
        continue;
      }
      seenNames.add(name);
      const tags = el.tags ?? {};
      if (
        (tags.amenity === 'place_of_worship' && tags.religion === 'shinto') ||
        tags.historic === 'shrine'
      ) {
        pois.push({ lat, lng, name, type: 'shrine', categoryLabel: '神社' });
      } else if (
        tags.historic === 'monument' ||
        tags.historic === 'memorial' ||
        tags.historic === 'stone'
      ) {
        pois.push({ lat, lng, name, type: 'monument', categoryLabel: '石碑' });
      } else {
        pois.push({ lat, lng, name, type: 'building', categoryLabel: '建築物' });
      }
    }
    return pois;
  } catch {
    return [];
  }
}

interface ElevationAnalysis {
  elevationGainM: number;
  steepestCoord: [number, number] | null;
  steepestGradePct: number;
  steepestGainM: number;
  steepestDistKm: number;
}

async function analyzeRouteElevation(
  coords: [number, number][]
): Promise<ElevationAnalysis> {
  const sampleCount = Math.min(10, Math.max(4, coords.length));
  const sampled: { coord: [number, number]; distanceKm: number }[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const frac = i / (sampleCount - 1);
    sampled.push(getCoordAtFraction(coords, frac));
  }

  try {
    const controller = new AbortController();
    const tid = window.setTimeout(() => controller.abort(), 2500);
    const lats = sampled.map((s) => s.coord[0].toFixed(5)).join(',');
    const lngs = sampled.map((s) => s.coord[1].toFixed(5)).join(',');
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
      { signal: controller.signal }
    );
    window.clearTimeout(tid);
    if (!res.ok) throw new Error('elevation fetch failed');
    const json = (await res.json()) as { elevation?: number[] };
    const elevs = json.elevation;
    if (!elevs || elevs.length !== sampled.length) throw new Error('invalid elevation');

    let totalGain = 0;
    let maxGrade = 0;
    let maxSegGain = 0;
    let steepestIdx = -1;

    for (let i = 1; i < elevs.length; i++) {
      const diffM = elevs[i] - elevs[i - 1];
      if (diffM > 0) totalGain += diffM;
      const segKm = Math.max(0.05, sampled[i].distanceKm - sampled[i - 1].distanceKm);
      const gradePct = (diffM / (segKm * 1000)) * 100;
      if (gradePct > maxGrade) {
        maxGrade = gradePct;
        maxSegGain = Math.max(0, Math.round(diffM));
        steepestIdx = i;
      }
    }

    return {
      elevationGainM: Math.round(totalGain),
      steepestCoord: steepestIdx >= 0 ? sampled[steepestIdx].coord : null,
      steepestGradePct: Math.round(maxGrade * 10) / 10,
      steepestGainM: maxSegGain,
      steepestDistKm: steepestIdx >= 0 ? sampled[steepestIdx].distanceKm : 0,
    };
  } catch {
    return {
      elevationGainM: 0,
      steepestCoord: null,
      steepestGradePct: 0,
      steepestGainM: 0,
      steepestDistKm: 0,
    };
  }
}

async function buildCourseSpots(
  coords: [number, number][],
  routeType: RunningRouteType,
  totalKm: number
): Promise<{ spots: CourseSpot[]; elevationGainM: number }> {
  const scenic1 = getCoordAtFraction(coords, 0.25);
  const mid = getCoordAtFraction(coords, 0.5);
  const scenic2 = getCoordAtFraction(coords, 0.84);
  const end = getCoordAtFraction(coords, 1.0);

  const [pois, elev] = await Promise.all([
    fetchNearbyOverpassPois(mid.coord, Math.min(2000, Math.max(800, totalKm * 350))),
    analyzeRouteElevation(coords),
  ]);

  const spot1Poi = pois[0];
  const spot2Poi = pois[1];

  const spots: CourseSpot[] = [
    {
      id: 'spot_poi_1',
      type: spot1Poi?.type ?? 'checkpoint',
      categoryLabel: spot1Poi?.categoryLabel ?? '通過地点',
      name: spot1Poi
        ? `${spot1Poi.categoryLabel}：${spot1Poi.name}`
        : `チェックポイント：序盤通過（${scenic1.distanceKm.toFixed(1)}km）`,
      note: spot1Poi
        ? `周辺${spot1Poi.categoryLabel}「${spot1Poi.name}」付近を通過。呼吸とリズムを整えよう。`
        : `スタートから ${scenic1.distanceKm.toFixed(1)}km の通過チェックポイント。ペースを安定させよう。`,
      lat: spot1Poi?.lat ?? scenic1.coord[0],
      lng: spot1Poi?.lng ?? scenic1.coord[1],
      distanceKmFromStart: scenic1.distanceKm,
    },
  ];

  if (routeType === 'round_trip') {
    spots.push({
      id: 'spot_turnaround',
      type: 'turnaround',
      categoryLabel: '折り返し',
      name: '折り返しポイント（別ルート復路へ）',
      note: '往路クリア！帰り道は行きと異なるルートを通ってスタート地点へ戻ります。',
      lat: mid.coord[0],
      lng: mid.coord[1],
      distanceKmFromStart: mid.distanceKm,
    });
  } else {
    spots.push({
      id: 'spot_poi_mid',
      type: spot2Poi?.type ?? 'checkpoint',
      categoryLabel: spot2Poi?.categoryLabel ?? '通過地点',
      name: spot2Poi
        ? `${spot2Poi.categoryLabel}：${spot2Poi.name}`
        : `チェックポイント：中間通過（${mid.distanceKm.toFixed(1)}km）`,
      note: spot2Poi
        ? `中間地点の${spot2Poi.categoryLabel}「${spot2Poi.name}」付近を通過。フォームを意識して後半へ。`
        : `コース中間（${mid.distanceKm.toFixed(1)}km地点）の距離チェックポイント。`,
      lat: spot2Poi?.lat ?? mid.coord[0],
      lng: spot2Poi?.lng ?? mid.coord[1],
      distanceKmFromStart: mid.distanceKm,
    });
  }

  // Evidence-based Tough Point (Elevation grade OR second-half endurance push zone)
  const hasRealClimb = elev.steepestCoord !== null && elev.steepestGradePct >= 0.8;
  const fallbackTough = getCoordAtFraction(coords, routeType === 'round_trip' ? 0.68 : 0.7);
  const toughCoord = hasRealClimb && elev.steepestCoord ? elev.steepestCoord : fallbackTough.coord;
  const toughDist = hasRealClimb ? elev.steepestDistKm : fallbackTough.distanceKm;

  spots.push({
    id: 'spot_tough_1',
    type: 'tough',
    categoryLabel: '高負荷区間',
    name: hasRealClimb
      ? `⚠️ きついポイント：上り坂区間（勾配 +${elev.steepestGradePct}% / +${elev.steepestGainM}m）`
      : `⚠️ きついポイント：後半負荷区間（${toughDist.toFixed(1)}km地点）`,
    note: hasRealClimb
      ? `標高データ解析によりルート最大の登り勾配（+${elev.steepestGradePct}%、総獲得標高 ${elev.elevationGainM}m）を検出。腕振りを強めて突破するとボーナス！`
      : `平坦ルートのため後半 ${Math.round((toughDist / Math.max(0.5, totalKm)) * 100)}% 地点の持久負荷ゾーンを選定。ペース維持で突破するとボーナス！`,
    lat: toughCoord[0],
    lng: toughCoord[1],
    distanceKmFromStart: toughDist,
  });

  const spot3Poi = pois[2] ?? (routeType === 'round_trip' ? pois[1] : undefined);
  spots.push({
    id: 'spot_poi_2',
    type: spot3Poi?.type ?? 'checkpoint',
    categoryLabel: spot3Poi?.categoryLabel ?? '通過地点',
    name: spot3Poi
      ? `${spot3Poi.categoryLabel}：${spot3Poi.name}`
      : `チェックポイント：終盤通過（${scenic2.distanceKm.toFixed(1)}km）`,
    note: spot3Poi
      ? `終盤の${spot3Poi.categoryLabel}「${spot3Poi.name}」付近を通過。ゴールまであと少し！`
      : `終盤（${scenic2.distanceKm.toFixed(1)}km地点）の通過チェックポイント。ラストスパート！`,
    lat: spot3Poi?.lat ?? scenic2.coord[0],
    lng: spot3Poi?.lng ?? scenic2.coord[1],
    distanceKmFromStart: scenic2.distanceKm,
  });

  if (routeType === 'one_way') {
    spots.push({
      id: 'spot_goal',
      type: 'goal',
      categoryLabel: 'ゴール',
      name: '🏁 ゴール地点（片道フィニッシュ）',
      note: '目標距離走破！ストレッチでクールダウンしよう。',
      lat: end.coord[0],
      lng: end.coord[1],
      distanceKmFromStart: end.distanceKm,
    });
  }

  return { spots, elevationGainM: elev.elevationGainM };
}

export async function generateSafeRunningCourse(
  start: [number, number],
  targetKm: number,
  routeType: RunningRouteType,
  variantSeed: number = 0
): Promise<GeneratedCourse> {
  const effectiveKm = Math.max(1.0, Math.round(targetKm * 10) / 10);
  const bearing1 = (40 + variantSeed * 73) % 360;
  const loopSpread = variantSeed % 2 === 0 ? 48 : -48;

  // Attempt OSRM pedestrian routing first (with 2 distinct waypoints for round_trip so return uses a different road)
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);

    let url = '';
    if (routeType === 'round_trip') {
      const legKm = Math.max(0.35, effectiveKm / 3.1);
      const wp1 = offsetCoord(start[0], start[1], bearing1, legKm);
      const wp2 = offsetCoord(start[0], start[1], (bearing1 + loopSpread + 360) % 360, legKm);
      url = `https://router.project-osrm.org/route/v1/foot/${start[1]},${start[0]};${wp1[1]},${wp1[0]};${wp2[1]},${wp2[0]};${start[1]},${start[0]}?overview=full&geometries=geojson`;
    } else {
      const dest = offsetCoord(start[0], start[1], bearing1, Math.max(0.6, effectiveKm / 1.3));
      url = `https://router.project-osrm.org/route/v1/foot/${start[1]},${start[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`;
    }

    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timeoutId);

    if (res.ok) {
      const json = (await res.json()) as {
        routes?: { geometry?: { coordinates?: [number, number][] } }[];
      };
      const raw = json.routes?.[0]?.geometry?.coordinates;
      if (raw && raw.length >= 4) {
        const coords: [number, number][] = raw.map(([lng, lat]) => [lat, lng]);
        if (routeType === 'round_trip') {
          coords[coords.length - 1] = coords[0];
        }
        const plannedDistanceKm = computePathDistanceKm(coords);
        const { spots, elevationGainM } = await buildCourseSpots(
          coords,
          routeType,
          plannedDistanceKm
        );
        return {
          routeType,
          variantSeed,
          targetDistanceKm: effectiveKm,
          plannedDistanceKm,
          elevationGainM,
          coordinates: coords,
          spots,
          source: 'osrm',
        };
      }
    }
  } catch {
    // Fallback to deterministic safe pedestrian loop/curve below
  }

  const fallbackCoords = buildFallbackCoordinates(start, effectiveKm, routeType, variantSeed);
  const plannedDistanceKm = computePathDistanceKm(fallbackCoords);
  const { spots, elevationGainM } = await buildCourseSpots(
    fallbackCoords,
    routeType,
    plannedDistanceKm
  );

  return {
    routeType,
    variantSeed,
    targetDistanceKm: effectiveKm,
    plannedDistanceKm,
    elevationGainM,
    coordinates: fallbackCoords,
    spots,
    source: 'safe-fallback',
  };
}
