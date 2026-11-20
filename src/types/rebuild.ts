// Feature flag for future nutrition module (keep false until ready)
export const ENABLE_NUTRITION = false;

export type WeightTiming = 'fasted' | 'normal' | 'post_meal';

export type ShiftHours = 'none' | 'short' | 'medium' | 'long';

// 3-level condition: 1 = 不調・疲れ気味, 2 = 普通, 3 = 好調
export type ConditionLevel = 1 | 2 | 3;

export type WorkoutExerciseId =
  | 'pushup_normal'
  | 'pushup_knee'
  | 'abs_crunch'
  | 'abs_legraise'
  | 'abs_plank'
  | 'stretch_shift'
  | 'stretch_sleep'
  | 'stretch_morning';

export type TabId = 'home' | 'workout' | 'weight' | 'trend' | 'daily';

export interface DailyTask {
  id: string;
  title: string;
  subtitle: string;
  category: 'recovery' | 'strength' | 'weight' | 'sleep';
}

export interface DailyRecord {
  dateKey: string; // YYYY-MM-DD in JST (05:00 boundary)
  conditionLevel: ConditionLevel | null;
  conditionUpdatedAt: string | null;
  rawWeight: number | null;
  weightTiming: WeightTiming | null;
  normalizedWeight: number | null;
  shiftHours: ShiftHours;
  completedTasks: string[];
  completedWorkouts: WorkoutExerciseId[];
  // Reserved field for future nutrition feature
  nutritionReserved?: Record<string, unknown> | null;
}

export interface UserProfile {
  baselineWeight: number;
  targetWeight: number;
  defaultShiftHours?: ShiftHours;
}

export interface AppState {
  records: Record<string, DailyRecord>;
  profile: UserProfile;
  // Reserved root-level field for future nutrition feature
  nutritionReserved?: Record<string, unknown> | null;
}

export interface ScoreBreakdown {
  conditionScore: number; // 0..40
  weightScore: number; // 0..30
  strengthScore: number; // 0..30
  totalScore: number; // 0..100 (cumulative, capped daily delta ±8pt)
}

export interface StageInfo {
  stage: number; // 0..10
  code: string;
  label: string;
  description: string;
  accentColor: string;
  isDanger: boolean;
}
