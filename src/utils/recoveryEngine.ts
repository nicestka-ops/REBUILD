import {
  ConditionLevel,
  DailyRecord,
  DailyTask,
  ScoreBreakdown,
  ShiftHours,
  StageInfo,
  UserProfile,
  WeightTiming,
} from '../types/rebuild';
import { getPastDateKeys, shiftDateKey } from './dateJst';

export const CONDITION_OPTIONS: {
  level: ConditionLevel;
  label: string;
  shortLabel: string;
  points: number;
  description: string;
}[] = [
  { level: 1, label: '不調・疲れ気味', shortLabel: '不調', points: 15, description: 'リカバリー・ケア' },
  { level: 2, label: '普通', shortLabel: '普通', points: 20, description: 'バランス維持' },
  { level: 3, label: '好調', shortLabel: '好調', points: 25, description: '強化・ランニング' },
];

export const WEIGHT_TIMING_OPTIONS: {
  id: WeightTiming;
  label: string;
  offset: number;
  badge: string;
}[] = [
  { id: 'fasted', label: '空腹・起床後（食前）', offset: 0.0, badge: '0.0kg' },
  { id: 'normal', label: '通常・食間', offset: -0.3, badge: '-0.3kg' },
  { id: 'post_meal', label: '食後（満腹）', offset: -0.7, badge: '-0.7kg' },
];

export const SHIFT_OPTIONS: {
  id: ShiftHours;
  label: string;
  loadLabel: string;
}[] = [
  { id: 'none', label: 'なし', loadLabel: 'オフ' },
  { id: 'short', label: '〜4h', loadLabel: '軽負荷' },
  { id: 'medium', label: '4〜8h', loadLabel: '中負荷' },
  { id: 'long', label: '8h〜', loadLabel: '高負荷' },
];

export function normalizeConditionLevel(raw: number | null | undefined): ConditionLevel | null {
  if (raw === null || raw === undefined) return null;
  if (raw <= 1) return 1;
  if (raw === 2) return 2;
  return 3;
}

export function computeNormalizedWeight(rawWeight: number, timing: WeightTiming): number {
  const option = WEIGHT_TIMING_OPTIONS.find((o) => o.id === timing);
  const offset = option ? option.offset : 0;
  return Math.round((rawWeight + offset) * 10) / 10;
}

export function getConditionPoints(level: ConditionLevel | number | null): number {
  const norm = normalizeConditionLevel(level);
  if (norm === 1) return 15;
  if (norm === 2) return 20;
  if (norm === 3) return 25;
  return 0;
}

export function hasAnyDailyAction(rec?: DailyRecord): boolean {
  if (!rec) return false;
  return (
    rec.conditionLevel !== null ||
    rec.rawWeight !== null ||
    rec.completedWorkouts.length > 0 ||
    rec.completedTasks.length > 0 ||
    (rec.runningDistanceKm ?? 0) > 0
  );
}

export function getLatestNormalizedWeight(
  records: Record<string, DailyRecord>,
  upToDateKey: string
): { weight: number; dateKey: string } | null {
  const keys = Object.keys(records)
    .filter((k) => k <= upToDateKey && records[k].normalizedWeight !== null)
    .sort((a, b) => b.localeCompare(a));

  if (keys.length === 0) return null;
  const k = keys[0];
  return { weight: records[k].normalizedWeight as number, dateKey: k };
}

function computePositiveDayScore(
  records: Record<string, DailyRecord>,
  profile: UserProfile,
  dk: string
): { conditionScore: number; weightScore: number; strengthScore: number; dailyTotal: number } {
  const rec = records[dk];

  // 1. Condition check-in reward (0..25, NEVER negative for fatigue)
  const conditionScore = getConditionPoints(rec?.conditionLevel ?? null);

  // 2. Normalized Weight Progress (0..25)
  const latestWeightInfo = getLatestNormalizedWeight(records, dk);
  let weightScore = 10;
  if (latestWeightInfo) {
    const span = Math.max(1, profile.targetWeight - profile.baselineWeight);
    const progress = (latestWeightInfo.weight - profile.baselineWeight) / span;
    weightScore = Math.round(Math.max(0, Math.min(1, progress)) * 25);
  }

  // 3. Workouts, Running Distance (km) & Daily Tasks (0..35)
  const workouts = rec?.completedWorkouts.length ?? 0;
  const tasks = rec?.completedTasks.length ?? 0;
  const runKm = rec?.runningDistanceKm ?? 0;
  const runPts = Math.min(12, runKm * 3);
  const strengthScore = Math.round(Math.min(35, workouts * 6.5 + tasks * 3.5 + runPts));

  return {
    conditionScore,
    weightScore,
    strengthScore,
    dailyTotal: Math.max(0, Math.min(85, conditionScore + weightScore + strengthScore)),
  };
}

/**
 * Cumulative Recovery Score (0..100):
 * - Fatigue ("不調・疲れ気味") NEVER causes a score penalty.
 * - Penalty (-6pt/day, capped at -8pt/day) applies ONLY on past days with ZERO actions
 *   (no condition check-in, no weight log, no workout, no running, no task).
 * - Any single action preserves the streak and prevents score decay.
 * - Daily upward/downward change is capped at ±8pt/day, and Stage 9/10 require 5+/10+ streak days.
 */
export function calculateScoreBreakdown(
  records: Record<string, DailyRecord>,
  profile: UserProfile,
  dateKey: string
): ScoreBreakdown {
  const MAX_DAILY_DELTA = 8;
  const INITIAL_DEFAULT_SCORE = 50;
  const horizonKeys = getPastDateKeys(dateKey, 14);

  const actionKeys = Object.keys(records)
    .filter((k) => k <= dateKey && hasAnyDailyAction(records[k]))
    .sort();

  const todayParts = computePositiveDayScore(records, profile, dateKey);

  // 7-day strength display for STRENGTH card (0..30)
  const past7 = getPastDateKeys(dateKey, 7);
  let workoutUnits = 0;
  for (const k of past7) {
    const r = records[k];
    if (!r) continue;
    workoutUnits +=
      r.completedWorkouts.length * 1.5 +
      r.completedTasks.length * 0.6 +
      (r.runningDistanceKm ?? 0) * 0.8;
  }
  const displayStrength = Math.round(Math.min(30, workoutUnits * 1.4));

  // New user / no recorded logs yet: start at 50 (Stage 5: ライトジョギング)
  if (actionKeys.length === 0) {
    return {
      conditionScore: todayParts.conditionScore,
      weightScore: todayParts.weightScore,
      strengthScore: displayStrength,
      totalScore: INITIAL_DEFAULT_SCORE,
    };
  }

  const firstActionKey = actionKeys[0];
  let runningScore = INITIAL_DEFAULT_SCORE;

  for (let i = 0; i < horizonKeys.length; i++) {
    const dk = horizonKeys[i];
    if (dk < firstActionKey) {
      continue;
    }

    const rec = records[dk];
    const isToday = dk === dateKey;
    const acted = hasAnyDailyAction(rec);

    if (!acted) {
      // Only penalize completed past days AFTER the user's first action where they did NOTHING
      if (!isToday) {
        runningScore = Math.max(0, runningScore - 6);
      }
      continue;
    }

    const dayParts = computePositiveDayScore(records, profile, dk);
    const streak = calculateStreakDays(records, dk);
    const streakBonus = Math.min(15, streak * 1.5);
    let target = Math.round(dayParts.dailyTotal + streakBonus);

    if (streak < 5) {
      target = Math.min(84, target);
    } else if (streak < 10) {
      target = Math.min(93, target);
    }

    // Fatigue never drops the score on an active day; score only moves upward or holds
    const rawDelta = Math.max(0, target - runningScore);
    const clampedDelta = Math.min(MAX_DAILY_DELTA, rawDelta);
    runningScore = Math.max(0, Math.min(100, runningScore + clampedDelta));
  }

  return {
    conditionScore: todayParts.conditionScore,
    weightScore: todayParts.weightScore,
    strengthScore: displayStrength,
    totalScore: runningScore,
  };
}

export function getStageFromScore(score: number): StageInfo {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s <= 9) {
    return {
      stage: 0,
      code: 'STAGE 00',
      label: 'CRAWL // 限界消耗',
      description: '手と膝をついて這いずり進む状態。まずは睡眠と休息を最優先に。',
      accentColor: '#FF3B30',
      isDanger: true,
    };
  }
  if (s <= 19) {
    return {
      stage: 1,
      code: 'STAGE 01',
      label: 'DRAG // 重度疲労',
      description: '猫背で足を引きずる状態。無理な負荷は避け、回復に専念。',
      accentColor: '#99CC00',
      isDanger: false,
    };
  }
  if (s <= 29) {
    return {
      stage: 2,
      code: 'STAGE 02',
      label: 'SLUMP // 疲労蓄積',
      description: '肩を落としてトボトボ歩く状態。栄養とストレッチで底上げを。',
      accentColor: '#99CC00',
      isDanger: false,
    };
  }
  if (s <= 39) {
    return {
      stage: 3,
      code: 'STAGE 03',
      label: 'STEADY WALK // 回復初期',
      description: '背筋が伸びて普通に歩ける状態。基礎リズムが戻り始めています。',
      accentColor: '#99CC00',
      isDanger: false,
    };
  }
  if (s <= 49) {
    return {
      stage: 4,
      code: 'STAGE 04',
      label: 'BRISK WALK // 活動再開',
      description: '腕を振って早歩き。軽い自重トレーニングの再開ライン。',
      accentColor: '#CCFF00',
      isDanger: false,
    };
  }
  if (s <= 59) {
    return {
      stage: 5,
      code: 'STAGE 05',
      label: 'LIGHT JOG // 軽快ジョグ',
      description: '引き締まった体型で軽快にジョギング。コンディション上向き。',
      accentColor: '#CCFF00',
      isDanger: false,
    };
  }
  if (s <= 69) {
    return {
      stage: 6,
      code: 'STAGE 06',
      label: 'FORM RUN // 筋力定着',
      description: '筋肉がつき始め、安定したフォームで走れる状態。',
      accentColor: '#CCFF00',
      isDanger: false,
    };
  }
  if (s <= 79) {
    return {
      stage: 7,
      code: 'STAGE 07',
      label: 'POWER RUN // 全力スプリント',
      description: '厚みのある筋肉質な体格。シアン×ボルトの覚醒スプリント。',
      accentColor: '#00F0FF',
      isDanger: false,
    };
  }
  if (s <= 89) {
    return {
      stage: 8,
      code: 'STAGE 08',
      label: 'FULL SPRINT // 残像スプリント',
      description: '屈強な体格で大きくストライドを広げ、残像を伴って全力疾走。',
      accentColor: '#00F0FF',
      isDanger: false,
    };
  }
  if (s <= 95) {
    return {
      stage: 9,
      code: 'STAGE 09',
      label: 'CR7 MODE // 爆発スプリント',
      description: '広い肩幅・強靭な大腿部・短髪アップバング。ゴールド×ライムの爆発フォーム。',
      accentColor: '#FFD60A',
      isDanger: false,
    };
  }
  return {
    stage: 10,
    code: 'STAGE 10',
    label: 'GOKU MODE // 限界突破',
    description: '逆立つ髪と屈強な体格で地面スレスレを疾走。オーラブルーの限界突破。',
    accentColor: '#00D4FF',
    isDanger: false,
  };
}

export function calculateStreakDays(records: Record<string, DailyRecord>, todayKey: string): number {
  let streak = 0;
  let cursor = todayKey;

  if (!hasAnyDailyAction(records[cursor])) {
    cursor = shiftDateKey(cursor, -1);
  }

  while (hasAnyDailyAction(records[cursor])) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function generateDailyTasks(
  shiftHours: ShiftHours,
  conditionLevel: ConditionLevel | number | null,
  hasWeightToday: boolean
): DailyTask[] {
  const norm = normalizeConditionLevel(conditionLevel);
  const isFatigued = norm === 1 || shiftHours === 'long';
  const isEnergetic = norm === 3 && shiftHours !== 'long';

  const tasks: DailyTask[] = [];

  if (isFatigued) {
    tasks.push({
      id: 'task_stretch',
      title: '【ケア】バイト後・就寝前・肩腰ストレッチ',
      subtitle: '疲労日は減点なし！ストレッチ1つでストリーク継続',
      category: 'recovery',
    });
    tasks.push({
      id: 'task_sleep',
      title: '23:30までに就寝（7h+睡眠確保）',
      subtitle: '成長ホルモン分泌と体重回復を最優先',
      category: 'sleep',
    });
    if (!hasWeightToday) {
      tasks.push({
        id: 'task_weight',
        title: '今日の体重を記録（タグ補正付き）',
        subtitle: '疲労による減少トレンドを早期検知',
        category: 'weight',
      });
    }
    return tasks.slice(0, 3);
  }

  if (isEnergetic) {
    tasks.push({
      id: 'task_strength',
      title: '【強化】腕立て・腹筋（レッグレイズ/プランク）',
      subtitle: '好調な日に上半身と体幹をしっかり鍛える',
      category: 'strength',
    });
    tasks.push({
      id: 'task_run_goal',
      title: '【強化】ランニング（2〜5km 目標）＆距離記録',
      subtitle: '走行距離（km）に応じてスコアが累積アップ',
      category: 'strength',
    });
    tasks.push({
      id: 'task_weight',
      title: '体重ログ＆ベース体重チェック',
      subtitle: '目標体重に向けた回復カーブを確認',
      category: 'weight',
    });
    return tasks.slice(0, 3);
  }

  // 普通 (Balance mode) or unanswered
  tasks.push({
    id: 'task_weight',
    title: '毎日の体重記録（食前/食後タグ選択）',
    subtitle: 'ブレを補正したベース体重をトラッキング',
    category: 'weight',
  });
  tasks.push({
    id: 'task_light_move',
    title: '【バランス】腕立て・クランチ＆軽いジョギング',
    subtitle: '無理のない範囲で筋力と心肺ベースを維持',
    category: 'strength',
  });
  tasks.push({
    id: 'task_sleep',
    title: '就寝前リラックスストレッチ＆睡眠',
    subtitle: '翌朝JST 05:00のリセットに向けて回復',
    category: 'sleep',
  });

  return tasks;
}
