import {
  ConditionLevel,
  DailyRecord,
  DailyTask,
  ScoreBreakdown,
  ShiftHours,
  StageInfo,
  UserProfile,
  WeightTiming,
  WorkoutExerciseId,
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

export interface ShiftConditionPlan {
  shiftLabel: string;
  conditionLabel: string;
  recommendedRunKm: number;
  recommendedRunLabel: string;
  modeBadge: string;
  modeTitle: string;
  modeDesc: string;
  recommendedWorkoutIds: WorkoutExerciseId[];
  optionalWorkoutIds: WorkoutExerciseId[];
}

export function getShiftAndConditionPlan(
  shiftHours: ShiftHours,
  conditionLevel: ConditionLevel | number | null,
  score: number = 50
): ShiftConditionPlan {
  const norm = normalizeConditionLevel(conditionLevel);
  const effectiveCond: 1 | 2 | 3 = norm ?? 2;
  const s = Math.max(0, Math.min(100, Math.round(score)));

  const shiftLabel =
    shiftHours === 'none'
      ? 'バイトなし'
      : shiftHours === 'short'
      ? '短時間 (〜4h)'
      : shiftHours === 'medium'
      ? '中時間 (4〜8h)'
      : '長時間 (8h〜)';

  const conditionLabel =
    norm === 1
      ? '不調・疲れ気味'
      : norm === 2
      ? '普通'
      : norm === 3
      ? '好調'
      : '未回答（標準）';

  // 1. Recommended Running Distance (km) driven by shiftHours x recoveryScore (0..100pt)
  let recommendedRunKm = 5.0;
  let recommendedRunLabel = '推奨: 5.0 km';

  if (shiftHours === 'long') {
    recommendedRunKm = 0.0;
    recommendedRunLabel = '推奨: 0.0 km（休養・ストレッチ推奨 / 任意 0.0〜1.0 km）';
  } else if (shiftHours === 'none') {
    // Off-shift: ALWAYS >= 5.0 km, scaling up with score up to 10.0 km
    recommendedRunKm = Math.min(10.0, Math.round((5.0 + Math.max(0, (s - 50) * 0.1)) * 10) / 10);
    recommendedRunLabel = `推奨: ${recommendedRunKm.toFixed(1)} km`;
  } else if (shiftHours === 'short') {
    // Short shift (~4h): 1.5 km ~ 3.5 km scaling with score
    recommendedRunKm = Math.min(3.5, Math.max(1.5, Math.round((1.5 + (s / 100) * 2.0) * 10) / 10));
    recommendedRunLabel = `推奨: ${recommendedRunKm.toFixed(1)} km`;
  } else {
    // Medium shift (4~8h): 0.5 km ~ 2.0 km scaling with score
    recommendedRunKm = Math.min(2.0, Math.max(0.5, Math.round((0.5 + (s / 100) * 1.5) * 10) / 10));
    recommendedRunLabel = `推奨: ${recommendedRunKm.toFixed(1)} km`;
  }

  // 2. Workout Mode & Recommended / Optional Exercises
  // If fatigued (condition === 1), prioritize stretch & light care across ALL shift types
  if (norm === 1) {
    return {
      shiftLabel,
      conditionLabel,
      recommendedRunKm,
      recommendedRunLabel,
      modeBadge: 'RECOVERY CARE MODE',
      modeTitle: `【疲労ケア優先】${shiftLabel} × 不調・疲れ気味`,
      modeDesc:
        '不調・疲労の日は減点されません。無理な筋トレは控え、ストレッチと休息を最優先にしましょう。',
      recommendedWorkoutIds: ['stretch_shift', 'stretch_shoulder', 'stretch_sleep'],
      optionalWorkoutIds:
        shiftHours === 'none' ? ['pushup_knee', 'running_jog'] : ['pushup_knee'],
    };
  }

  if (shiftHours === 'long') {
    return {
      shiftLabel,
      conditionLabel,
      recommendedRunKm,
      recommendedRunLabel,
      modeBadge: 'LONG SHIFT CARE',
      modeTitle: '【長時間シフトケア】全身・腰・肩甲骨ストレッチ中心',
      modeDesc:
        '8時間以上の稼働日は疲労回復を最優先。ストレッチを中心に体をほぐし、筋トレやランは任意枠に留めましょう。',
      recommendedWorkoutIds: ['stretch_shift', 'stretch_shoulder', 'stretch_sleep'],
      optionalWorkoutIds: ['pushup_knee', 'abs_plank', 'running_jog'],
    };
  }

  if (shiftHours === 'medium') {
    return {
      shiftLabel,
      conditionLabel,
      recommendedRunKm,
      recommendedRunLabel,
      modeBadge: 'MEDIUM SHIFT BALANCE',
      modeTitle: '【中時間シフト】消耗を抑えた筋トレ＋リカバリー',
      modeDesc:
        '4〜8時間バイトの日は消耗を抑えた膝つき腕立て・腹筋と、バイト後のリカバリーストレッチを中心に組みます。',
      recommendedWorkoutIds:
        effectiveCond === 3
          ? ['pushup_knee', 'abs_crunch', 'abs_plank', 'stretch_shift', 'running_jog']
          : ['pushup_knee', 'abs_plank', 'stretch_shift', 'stretch_shoulder'],
      optionalWorkoutIds: effectiveCond === 3 ? ['running_goal'] : ['running_jog'],
    };
  }

  if (shiftHours === 'short') {
    return {
      shiftLabel,
      conditionLabel,
      recommendedRunKm,
      recommendedRunLabel,
      modeBadge: 'SHORT SHIFT ACTIVE',
      modeTitle: '【短時間シフト】軽め〜標準の筋トレ＋短時間ラン',
      modeDesc:
        '〜4時間バイトの日は軽め〜標準の腕立て・腹筋に加え、短時間ランニングとストレッチをバランス良く実施しましょう。',
      recommendedWorkoutIds:
        effectiveCond === 3
          ? ['pushup_normal', 'abs_crunch', 'abs_plank', 'running_goal', 'stretch_shift']
          : ['pushup_normal', 'abs_crunch', 'running_jog', 'stretch_shift'],
      optionalWorkoutIds: ['stretch_sleep'],
    };
  }

  // shiftHours === 'none'
  return {
    shiftLabel,
    conditionLabel,
    recommendedRunKm,
    recommendedRunLabel,
    modeBadge: effectiveCond === 3 ? 'OFF-SHIFT POWER MODE' : 'OFF-SHIFT STANDARD',
    modeTitle:
      effectiveCond === 3
        ? '【バイトなし×好調】筋トレ＆距離チャレンジメイン'
        : '【バイトなし】腕立て・腹筋・ランニングメイン',
    modeDesc:
      'バイトがない日は腕立て伏せ（ノーマル/回数チャレンジ）、腹筋（クランチ・レッグレイズ・プランク）、ランニングをしっかり積むチャンスです。',
    recommendedWorkoutIds:
      effectiveCond === 3
        ? ['pushup_normal', 'abs_crunch', 'abs_legraise', 'abs_plank', 'running_goal']
        : ['pushup_normal', 'abs_crunch', 'abs_plank', 'running_jog'],
    optionalWorkoutIds: ['stretch_sleep'],
  };
}

export function generateDailyTasks(
  shiftHours: ShiftHours,
  conditionLevel: ConditionLevel | number | null,
  hasWeightToday: boolean,
  score: number = 50
): DailyTask[] {
  const plan = getShiftAndConditionPlan(shiftHours, conditionLevel, score);
  const norm = normalizeConditionLevel(conditionLevel);
  const tasks: DailyTask[] = [];

  if (norm === 1 || shiftHours === 'long') {
    tasks.push({
      id: 'task_stretch',
      title:
        shiftHours === 'long'
          ? '【長時間ケア】全身・腰・肩甲骨ストレッチ'
          : '【ケア】バイト後・就寝前・肩腰ストレッチ',
      subtitle: `${plan.recommendedRunLabel}｜疲労日は減点なし・ストレッチ1つで継続`,
      category: 'recovery',
    });
    tasks.push({
      id: 'task_sleep',
      title: '23:30までに就寝（7h+睡眠確保）',
      subtitle: '成長ホルモン分泌と疲労リセットを最優先',
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

  if (shiftHours === 'medium') {
    tasks.push({
      id: 'task_medium_strength',
      title: '【中時間】膝つき腕立て・腹筋＆バイト後ストレッチ',
      subtitle: '消耗を抑えつつ体幹と回復を両立',
      category: 'strength',
    });
    tasks.push({
      id: 'task_run_goal',
      title: `ランニング目安（${plan.recommendedRunLabel}）`,
      subtitle: '走行距離（km）の記録は累積スコアへ反映',
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

  // none or short
  tasks.push({
    id: 'task_strength',
    title:
      shiftHours === 'none'
        ? '【メイン】腕立て伏せ＆腹筋（クランチ/レッグレイズ/プランク）'
        : '【短時間】腕立て・腹筋＆バイト後ストレッチ',
    subtitle: `${plan.shiftLabel} × ${plan.conditionLabel} に合わせたメニュー`,
    category: 'strength',
  });
  tasks.push({
    id: 'task_run_goal',
    title: `ランニング（${plan.recommendedRunLabel}）`,
    subtitle: '0.1km単位で記録してスコアと推移グラフに反映',
    category: 'strength',
  });
  tasks.push({
    id: 'task_weight',
    title: '毎日の体重記録（食前/食後タグ選択）',
    subtitle: 'ブレを補正したベース体重をトラッキング',
    category: 'weight',
  });

  return tasks;
}
