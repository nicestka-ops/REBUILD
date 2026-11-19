import { AppState, ConditionLevel, DailyRecord, ShiftHours, WeightTiming } from '../types/rebuild';
import { getJstRebuildDateKey, shiftDateKey } from './dateJst';
import { computeNormalizedWeight } from './recoveryEngine';

const STORAGE_KEY = 'rebuild_fitness_state_v1';

export function createEmptyDailyRecord(dateKey: string): DailyRecord {
  return {
    dateKey,
    conditionLevel: null,
    conditionUpdatedAt: null,
    rawWeight: null,
    weightTiming: null,
    normalizedWeight: null,
    shiftHours: 'none',
    completedTasks: [],
    completedWorkouts: [],
    nutritionReserved: null,
  };
}

function createInitialSeedState(): AppState {
  const todayKey = getJstRebuildDateKey();
  const records: Record<string, DailyRecord> = {};

  // Seed past 10 days so trend charts & streak work immediately on first launch.
  // Today is intentionally left unanswered so the JST 05:00 check-in banner is shown.
  const seedPlan: {
    daysAgo: number;
    condition: ConditionLevel;
    rawWeight: number;
    timing: WeightTiming;
    shift: ShiftHours;
    workouts: ('squat' | 'pushup' | 'plank' | 'stretch')[];
  }[] = [
    { daysAgo: 10, condition: 1, rawWeight: 54.4, timing: 'normal', shift: 'long', workouts: ['stretch'] },
    { daysAgo: 9, condition: 2, rawWeight: 54.3, timing: 'fasted', shift: 'medium', workouts: ['stretch'] },
    { daysAgo: 8, condition: 2, rawWeight: 55.1, timing: 'post_meal', shift: 'long', workouts: ['stretch', 'plank'] },
    { daysAgo: 7, condition: 3, rawWeight: 54.7, timing: 'fasted', shift: 'short', workouts: ['squat', 'stretch'] },
    { daysAgo: 6, condition: 3, rawWeight: 55.3, timing: 'normal', shift: 'none', workouts: ['squat', 'pushup'] },
    { daysAgo: 5, condition: 3, rawWeight: 55.8, timing: 'post_meal', shift: 'medium', workouts: ['plank', 'stretch'] },
    { daysAgo: 4, condition: 4, rawWeight: 55.4, timing: 'fasted', shift: 'short', workouts: ['squat', 'pushup', 'plank'] },
    { daysAgo: 3, condition: 3, rawWeight: 56.0, timing: 'normal', shift: 'long', workouts: ['stretch'] },
    { daysAgo: 2, condition: 4, rawWeight: 55.9, timing: 'fasted', shift: 'none', workouts: ['squat', 'pushup', 'plank'] },
    { daysAgo: 1, condition: 4, rawWeight: 56.7, timing: 'post_meal', shift: 'short', workouts: ['squat', 'pushup', 'stretch'] },
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
    },
    nutritionReserved: null,
  };
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createInitialSeedState();
      saveAppState(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || typeof parsed !== 'object' || !parsed.records || !parsed.profile) {
      const seed = createInitialSeedState();
      saveAppState(seed);
      return seed;
    }
    return parsed;
  } catch {
    return createInitialSeedState();
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
