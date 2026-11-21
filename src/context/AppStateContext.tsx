import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  AppState,
  ConditionLevel,
  DailyRecord,
  RunningRouteType,
  ScoreBreakdown,
  ShiftHours,
  StageInfo,
  UserProfile,
  WeightTiming,
  WorkoutExerciseId,
} from '../types/rebuild';
import { getJstRebuildDateKey } from '../utils/dateJst';
import {
  calculateScoreBreakdown,
  calculateStreakDays,
  computeNormalizedWeight,
  getLatestNormalizedWeight,
  getStageFromScore,
} from '../utils/recoveryEngine';
import {
  clearAllAppData,
  createEmptyDailyRecord,
  loadAppState,
  resetToDemoState,
  saveAppState,
} from '../utils/storage';

interface AppStateContextValue {
  appState: AppState;
  todayKey: string;
  setTodayKey: React.Dispatch<React.SetStateAction<string>>;
  todayRecord: DailyRecord;
  breakdown: ScoreBreakdown;
  displayScore: number;
  stageInfo: StageInfo;
  streakDays: number;
  latestWeightInfo: { weight: number; dateKey: string } | null;
  debugScore: number | null;
  setDebugScore: (val: number | null) => void;
  replaceAppState: (next: AppState) => void;
  selectCondition: (level: ConditionLevel) => void;
  selectShift: (shiftHours: ShiftHours) => void;
  toggleTask: (taskId: string) => void;
  toggleWorkout: (workoutId: WorkoutExerciseId) => void;
  saveRunningDistance: (
    km: number,
    routeType?: RunningRouteType,
    toughPointsCleared?: number,
    markCompletedToday?: boolean
  ) => void;
  saveWeight: (rawWeight: number, timing: WeightTiming) => void;
  updateProfile: (nextProfile: UserProfile) => void;
  resetDemo: () => AppState;
  clearAllData: () => AppState;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [todayKey, setTodayKey] = useState<string>(() => getJstRebuildDateKey());
  const [debugScore, setDebugScore] = useState<number | null>(null);

  const commitAppState = useCallback((updater: AppState | ((prev: AppState) => AppState)) => {
    setAppState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveAppState(next);
      return next;
    });
  }, []);

  const updateTodayRecord = useCallback(
    (updater: (prev: DailyRecord) => DailyRecord) => {
      commitAppState((prev) => {
        const current =
          prev.records[todayKey] ??
          createEmptyDailyRecord(todayKey, prev.profile.defaultShiftHours ?? 'none');
        return {
          ...prev,
          records: {
            ...prev.records,
            [todayKey]: updater(current),
          },
        };
      });
    },
    [commitAppState, todayKey]
  );

  const selectCondition = useCallback(
    (level: ConditionLevel) => {
      updateTodayRecord((rec) => ({
        ...rec,
        conditionLevel: level,
        conditionUpdatedAt: new Date().toISOString(),
      }));
    },
    [updateTodayRecord]
  );

  const selectShift = useCallback(
    (shiftHours: ShiftHours) => {
      updateTodayRecord((rec) => ({
        ...rec,
        shiftHours,
      }));
    },
    [updateTodayRecord]
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      updateTodayRecord((rec) => {
        const exists = rec.completedTasks.includes(taskId);
        return {
          ...rec,
          completedTasks: exists
            ? rec.completedTasks.filter((id) => id !== taskId)
            : [...rec.completedTasks, taskId],
        };
      });
    },
    [updateTodayRecord]
  );

  const toggleWorkout = useCallback(
    (workoutId: WorkoutExerciseId) => {
      updateTodayRecord((rec) => {
        const exists = rec.completedWorkouts.includes(workoutId);
        return {
          ...rec,
          completedWorkouts: exists
            ? rec.completedWorkouts.filter((id) => id !== workoutId)
            : [...rec.completedWorkouts, workoutId],
        };
      });
    },
    [updateTodayRecord]
  );

  const saveRunningDistance = useCallback(
    (
      km: number,
      routeType?: RunningRouteType,
      toughPointsCleared?: number,
      markCompletedToday?: boolean
    ) => {
      updateTodayRecord((rec) => {
        const nextWorkouts = [...rec.completedWorkouts];
        if (km > 0 && !nextWorkouts.includes('running_jog') && !nextWorkouts.includes('running_goal')) {
          nextWorkouts.push('running_jog');
        }
        const nextTasks = [...rec.completedTasks];
        if (markCompletedToday) {
          // Sync running-related daily tasks across Home, Daily, and Workout
          for (const taskId of ['task_run_goal', 'task_light_move']) {
            if (!nextTasks.includes(taskId)) {
              nextTasks.push(taskId);
            }
          }
        }
        return {
          ...rec,
          runningDistanceKm: km,
          runningRouteType: routeType ?? rec.runningRouteType ?? null,
          runningToughPointsCleared:
            toughPointsCleared !== undefined
              ? Math.max(rec.runningToughPointsCleared ?? 0, toughPointsCleared)
              : rec.runningToughPointsCleared ?? 0,
          runningCompletedDateKey: markCompletedToday
            ? todayKey
            : rec.runningCompletedDateKey ?? null,
          completedWorkouts: nextWorkouts,
          completedTasks: nextTasks,
        };
      });
    },
    [updateTodayRecord, todayKey]
  );

  const saveWeight = useCallback(
    (rawWeight: number, timing: WeightTiming) => {
      const normalizedWeight = computeNormalizedWeight(rawWeight, timing);
      updateTodayRecord((rec) => ({
        ...rec,
        rawWeight,
        weightTiming: timing,
        normalizedWeight,
      }));
    },
    [updateTodayRecord]
  );

  const updateProfile = useCallback(
    (nextProfile: UserProfile) => {
      commitAppState((prev) => ({
        ...prev,
        profile: nextProfile,
      }));
    },
    [commitAppState]
  );

  const resetDemo = useCallback(() => {
    setDebugScore(null);
    const seed = resetToDemoState();
    setAppState(seed);
    return seed;
  }, []);

  const clearAllData = useCallback(() => {
    setDebugScore(null);
    const empty = clearAllAppData();
    setAppState(empty);
    return empty;
  }, []);

  const todayRecord = useMemo(
    () =>
      appState.records[todayKey] ??
      createEmptyDailyRecord(todayKey, appState.profile.defaultShiftHours ?? 'none'),
    [appState.records, todayKey, appState.profile.defaultShiftHours]
  );

  const breakdown = useMemo(
    () => calculateScoreBreakdown(appState.records, appState.profile, todayKey),
    [appState.records, appState.profile, todayKey]
  );

  const displayScore = debugScore !== null ? debugScore : breakdown.totalScore;
  const stageInfo = useMemo(() => getStageFromScore(displayScore), [displayScore]);
  const streakDays = useMemo(
    () => calculateStreakDays(appState.records, todayKey),
    [appState.records, todayKey]
  );
  const latestWeightInfo = useMemo(
    () => getLatestNormalizedWeight(appState.records, todayKey),
    [appState.records, todayKey]
  );

  const value: AppStateContextValue = {
    appState,
    todayKey,
    setTodayKey,
    todayRecord,
    breakdown,
    displayScore,
    stageInfo,
    streakDays,
    latestWeightInfo,
    debugScore,
    setDebugScore,
    replaceAppState: commitAppState,
    selectCondition,
    selectShift,
    toggleTask,
    toggleWorkout,
    saveRunningDistance,
    saveWeight,
    updateProfile,
    resetDemo,
    clearAllData,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
