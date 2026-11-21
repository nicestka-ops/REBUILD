import { AppState, ConditionLevel, DailyRecord, ShiftHours, WeightTiming, WorkoutExerciseId } from '../types/rebuild';
import { getJstRebuildDateKey, shiftDateKey } from './dateJst';
import { computeNormalizedWeight } from './recoveryEngine';

const STORAGE_KEY = 'rebuild_fitness_state_v1';

export function createEmptyDailyRecord(
  dateKey: string,
  defaultShift: ShiftHours = 'none'
): DailyRecord {
  return {
    dateKey,
    conditionLevel: null,
    conditionUpdatedAt: null,
    rawWeight: null,
    weightTiming: null,
    normalizedWeight: null,
    shiftHours: defaultShift,
    runningDistanceKm: null,
    runningRouteType: null,
    runningToughPointsCleared: 0,
    completedTasks: [],
    completedWorkouts: [],
    nutritionReserved: null,
  };
}

function createInitialSeedState(): AppState {
  const todayKey = getJstRebuildDateKey();
  const records: Record<string, DailyRecord> = {};

  const seedPlan: {
    daysAgo: number;
    condition: ConditionLevel;
    rawWeight: number;
    timing: WeightTiming;
    shift: ShiftHours;
    runKm: number | null;
    workouts: WorkoutExerciseId[];
  }[] = [
    { daysAgo: 10, condition: 1, rawWeight: 54.4, timing: 'normal', shift: 'long', runKm: null, workouts: ['stretch_shift'] },
    { daysAgo: 9, condition: 1, rawWeight: 54.3, timing: 'fasted', shift: 'medium', runKm: null, workouts: ['stretch_sleep'] },
    { daysAgo: 8, condition: 2, rawWeight: 55.1, timing: 'post_meal', shift: 'long', runKm: null, workouts: ['stretch_shift', 'abs_plank'] },
    { daysAgo: 7, condition: 2, rawWeight: 54.7, timing: 'fasted', shift: 'short', runKm: 1.5, workouts: ['pushup_knee', 'running_jog'] },
    { daysAgo: 6, condition: 2, rawWeight: 55.3, timing: 'normal', shift: 'none', runKm: 2.0, workouts: ['pushup_normal', 'abs_crunch', 'running_jog'] },
    { daysAgo: 5, condition: 2, rawWeight: 55.8, timing: 'post_meal', shift: 'medium', runKm: null, workouts: ['abs_plank', 'stretch_sleep'] },
    { daysAgo: 4, condition: 3, rawWeight: 55.4, timing: 'fasted', shift: 'short', runKm: 3.0, workouts: ['pushup_normal', 'abs_crunch', 'running_goal'] },
    { daysAgo: 3, condition: 2, rawWeight: 56.0, timing: 'normal', shift: 'long', runKm: null, workouts: ['stretch_shift'] },
    { daysAgo: 2, condition: 3, rawWeight: 55.9, timing: 'fasted', shift: 'none', runKm: 3.5, workouts: ['pushup_normal', 'abs_legraise', 'running_goal'] },
    { daysAgo: 1, condition: 3, rawWeight: 56.7, timing: 'post_meal', shift: 'short', runKm: 2.5, workouts: ['pushup_normal', 'abs_crunch', 'running_jog'] },
  ];

  for (const item of seedPlan) {
    const dk = shiftDateKey(todayKey, -item.daysAgo);
    records[dk] = {
      dateKey: dk,
      conditionLevel: item.condition,
      conditionUpdatedAt: `${dk}T08:15:00+09:00`,
      rawWeight: item.rawWeight,
      weightTiming: item.timing,
      normalizedWeight: computeNormalizedWeight(item.rawWeight, item.timing),
      shiftHours: item.shift,
      runningDistanceKm: item.runKm,
      completedTasks: ['task_weight', 'task_sleep'],
      completedWorkouts: item.workouts,
      nutritionReserved: null,
    };
  }

  return {
    records,
    profile: {
      baselineWeight: 54.0,
      targetWeight: 61.0,
      defaultShiftHours: 'none',
    },
    nutritionReserved: null,
  };
}

export function createEmptyAppState(): AppState {
  return {
    records: {},
    profile: {
      baselineWeight: 54.0,
      targetWeight: 61.0,
      defaultShiftHours: 'none',
    },
    nutritionReserved: null,
  };
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const empty = createEmptyAppState();
      saveAppState(empty);
      return empty;
    }
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || typeof parsed !== 'object' || !parsed.records || !parsed.profile) {
      const empty = createEmptyAppState();
      saveAppState(empty);
      return empty;
    }
    return parsed;
  } catch {
    return createEmptyAppState();
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function resetToDemoState(): AppState {
  const seed = createInitialSeedState();
  saveAppState(seed);
  return seed;
}

export function clearAllAppData(): AppState {
  try {
    const clearMatchingKeys = (store: Storage) => {
      const toRemove: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && (k === STORAGE_KEY || k.startsWith('rebuild_'))) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => store.removeItem(k));
    };
    clearMatchingKeys(localStorage);
    clearMatchingKeys(sessionStorage);
  } catch {
    // Ignore storage access errors silently
  }
  const empty = createEmptyAppState();
  saveAppState(empty);
  return empty;
}
