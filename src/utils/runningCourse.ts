import { RunningRouteType } from '../types/rebuild';

export type CoursePointType = 'scenic' | 'tough' | 'turnaround' | 'goal';

export interface CourseSpot {
  id: string;
  type: CoursePointType;
  name: string;
  note: string;
  lat: number;
  lng: number;
  distanceKmFromStart: number;
}

export interface GeneratedCourse {
  routeType: RunningRouteType;
  targetDistanceKm: number;
  plannedDistanceKm: number;
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
  routeType: RunningRouteType
): [number, number][] {
  const [lat0, lng0] = start;
  const steps = 16;

  if (routeType === 'round_trip') {
    // Outbound half-distance + return along parallel safe park/riverside arc
    const halfKm = targetKm / 2;
    const rawCoords: [number, number][] = [start];
    const baseBearing = 42;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sway = Math.sin(t * Math.PI) * 14;
      rawCoords.push(offsetCoord(lat0, lng0, baseBearing + sway, halfKm * t));
    }

    const turnaround = rawCoords[rawCoords.length - 1];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sway = Math.sin(t * Math.PI) * 18;
      const backBearing = baseBearing + 180 - sway;
      rawCoords.push(offsetCoord(turnaround[0], turnaround[1], backBearing, halfKm * t));
    }
    rawCoords[rawCoords.length - 1] = start;

    // Fine-scale around start so total Haversine matches targetKm closely
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

  // One-way gentle scenic curve toward targetKm
  const rawCoords: [number, number][] = [start];
  const baseBearing = 65;
  for (let i = 1; i <= steps * 2; i++) {
    const t = i / (steps * 2);
    const sway = Math.sin(t * Math.PI * 1.5) * 15;
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

function buildCourseSpots(
  coords: [number, number][],
  routeType: RunningRouteType
): CourseSpot[] {
  const scenic1 = getCoordAtFraction(coords, 0.25);
  const mid = getCoordAtFraction(coords, 0.5);
  const tough = getCoordAtFraction(coords, routeType === 'round_trip' ? 0.68 : 0.65);
  const scenic2 = getCoordAtFraction(coords, 0.84);
  const end = getCoordAtFraction(coords, 1.0);

  const spots: CourseSpot[] = [
    {
      id: 'spot_scenic_1',
      type: 'scenic',
      name: '見物スポット：緑道・リフレッシュポイント',
      note: '信号の少ない緑道エリア。肩の力を抜いてリズムを整えよう！',
      lat: scenic1.coord[0],
      lng: scenic1.coord[1],
      distanceKmFromStart: scenic1.distanceKm,
    },
  ];

  if (routeType === 'round_trip') {
    spots.push({
      id: 'spot_turnaround',
      type: 'turnaround',
      name: '折り返しポイント（折り返し折半地点）',
      note: '往路クリア！ここからスタート地点へ戻る復路スタート。',
      lat: mid.coord[0],
      lng: mid.coord[1],
      distanceKmFromStart: mid.distanceKm,
    });
  } else {
    spots.push({
      id: 'spot_scenic_mid',
      type: 'scenic',
      name: '見物スポット：川沿いビュー・中間チェック',
      note: '見晴らしの良い直線区間。呼吸を深くして後半へ！',
      lat: mid.coord[0],
      lng: mid.coord[1],
      distanceKmFromStart: mid.distanceKm,
    });
  }

  spots.push({
    id: 'spot_tough_1',
    type: 'tough',
    name: '⚠️ きついポイント：登り坂・後半ペース維持',
    note: 'コース最大の踏ん張りどころ！腕振りを意識してクリアするとボーナス獲得。',
    lat: tough.coord[0],
    lng: tough.coord[1],
    distanceKmFromStart: tough.distanceKm,
  });

  spots.push({
    id: 'spot_scenic_2',
    type: 'scenic',
    name: '見物スポット：公園ベンチ・クールダウン手前',
    note: 'ゴールまであと少し！景色を楽しみながらフォームを維持。',
    lat: scenic2.coord[0],
    lng: scenic2.coord[1],
    distanceKmFromStart: scenic2.distanceKm,
  });

  if (routeType === 'one_way') {
    spots.push({
      id: 'spot_goal',
      type: 'goal',
      name: '🏁 ゴール地点（片道フィニッシュ）',
      note: '目標距離走破！ストレッチでクールダウンしよう。',
      lat: end.coord[0],
      lng: end.coord[1],
      distanceKmFromStart: end.distanceKm,
    });
  }

  return spots;
}

export async function generateSafeRunningCourse(
  start: [number, number],
  targetKm: number,
  routeType: RunningRouteType
): Promise<GeneratedCourse> {
  const effectiveKm = Math.max(1.0, Math.round(targetKm * 10) / 10);

  // Attempt OSRM pedestrian routing first (falls back cleanly if offline/blocked)
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);

    let url = '';
    if (routeType === 'round_trip') {
      const wp = offsetCoord(start[0], start[1], 45, Math.max(0.4, effectiveKm / 2.6));
      url = `https://router.project-osrm.org/route/v1/foot/${start[1]},${start[0]};${wp[1]},${wp[0]};${start[1]},${start[0]}?overview=full&geometries=geojson`;
    } else {
      const dest = offsetCoord(start[0], start[1], 65, Math.max(0.6, effectiveKm / 1.3));
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
        const plannedDistanceKm = computePathDistanceKm(coords);
        return {
          routeType,
          targetDistanceKm: effectiveKm,
          plannedDistanceKm,
          coordinates: coords,
          spots: buildCourseSpots(coords, routeType),
          source: 'osrm',
        };
      }
    }
  } catch {
    // Fallback to deterministic safe pedestrian loop/curve below
  }

  const fallbackCoords = buildFallbackCoordinates(start, effectiveKm, routeType);
  const plannedDistanceKm = computePathDistanceKm(fallbackCoords);

  return {
    routeType,
    targetDistanceKm: effectiveKm,
    plannedDistanceKm,
    coordinates: fallbackCoords,
    spots: buildCourseSpots(fallbackCoords, routeType),
    source: 'safe-fallback',
  };
}
