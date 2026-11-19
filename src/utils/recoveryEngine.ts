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
  { level: 1, label: 'Lv.1 限界・激疲れ', shortLabel: 'Lv.1', points: 0, description: '休息最優先' },
  { level: 2, label: 'Lv.2 かなり疲労', shortLabel: 'Lv.2', points: 10, description: '軽めケア' },
  { level: 3, label: 'Lv.3 普通', shortLabel: 'Lv.3', points: 20, description: '安定維持' },
  { level: 4, label: 'Lv.4 良好', shortLabel: 'Lv.4', points: 30, description: '筋トレOK' },
  { level: 5, label: 'Lv.5 絶好調', shortLabel: 'Lv.5', points: 40, description: '全力ビルド' },
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

export function computeNormalizedWeight(rawWeight: number, timing: WeightTiming): number {
  const option = WEIGHT_TIMING_OPTIONS.find((o) => o.id === timing);
  const offset = option ? option.offset : 0;
  return Math.round((rawWeight + offset) * 10) / 10;
}

export function getConditionPoints(level: ConditionLevel | null): number {
  if (!level) return 0;
  return (level - 1) * 10;
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

export function calculateScoreBreakdown(
  records: Record<string, DailyRecord>,
  profile: UserProfile,
  dateKey: string
): ScoreBreakdown {
  const rec = records[dateKey];

  // 1. Condition Score (0..40)
  const conditionScore = getConditionPoints(rec?.conditionLevel ?? null);

  // 2. Weight Recovery Score (0..30)
  const latestWeightInfo = getLatestNormalizedWeight(records, dateKey);
  let weightScore = 15; // default neutral if no weight logged yet
  if (latestWeightInfo) {
    const span = Math.max(1, profile.targetWeight - profile.baselineWeight);
    const progress = (latestWeightInfo.weight - profile.baselineWeight) / span;
    weightScore = Math.round(Math.max(0, Math.min(1, progress)) * 30);
  }

  // 3. Strength & Consistency Score (0..30)
  // Combines 7-day workout activity + today's completed workouts/tasks
  const past7 = getPastDateKeys(dateKey, 7);
  let workoutUnits = 0;
  for (const k of past7) {
    const r = records[k];
    if (!r) continue;
    workoutUnits += r.completedWorkouts.length * 1.5 + r.completedTasks.length * 0.5;
  }
  const todayBonus = (rec?.completedWorkouts.length ?? 0) * 3 + (rec?.completedTasks.length ?? 0) * 1.5;
  const strengthScore = Math.round(Math.min(30, workoutUnits * 1.4 + todayBonus));

  const totalScore = Math.max(0, Math.min(100, conditionScore + weightScore + strengthScore));

  return {
    conditionScore,
    weightScore,
    strengthScore,
    totalScore,
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
      accentColor: '#CCFF00',
      isDanger: false,
    };
  }
  if (s <= 29) {
    return {
      stage: 2,
      code: 'STAGE 02',
      label: 'SLUMP // 疲労蓄積',
      description: '肩を落としてトボトボ歩く状態。栄養とストレッチで底上げを。',
      accentColor: '#CCFF00',
      isDanger: false,
    };
  }
  if (s <= 39) {
    return {
      stage: 3,
      code: 'STAGE 03',
      label: 'STEADY WALK // 回復初期',
      description: '背筋が伸びて普通に歩ける状態。基礎リズムが戻り始めています。',
      accentColor: '#CCFF00',
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
      description: '厚みのある筋肉質な体格。約30度前傾したハイペースラン。',
      accentColor: '#CCFF00',
      isDanger: false,
    };
  }
  if (s <= 89) {
    return {
      stage: 8,
      code: 'STAGE 08',
      label: 'FULL SPRINT // 残像スプリント',
      description: '屈強な体格で大きくストライドを広げ、残像を伴って全力疾走。',
      accentColor: '#CCFF00',
      isDanger: false,
    };
  }
  if (s <= 95) {
    return {
      stage: 9,
      code: 'STAGE 09',
      label: 'CR7 MODE // 爆発スプリント',
      description: '広い肩幅・強靭な大腿部・短髪アップバング。約42度前傾の超高速フォーム。',
      accentColor: '#CCFF00',
      isDanger: false,
    };
  }
  return {
    stage: 10,
    code: 'STAGE 10',
    label: 'GOKU MODE // 限界突破',
    description: '逆立つ髪と屈強な体格で地面スレスレを疾走。白い衝撃波オーラと集中線が噴出。',
    accentColor: '#CCFF00',
    isDanger: false,
  };
}

export function calculateStreakDays(records: Record<string, DailyRecord>, todayKey: string): number {
  let streak = 0;
  let cursor = todayKey;

  // If today is not yet answered, count streak up to yesterday if yesterday was answered
  const hasActivity = (r?: DailyRecord) =>
    Boolean(r && (r.conditionLevel !== null || r.rawWeight !== null || r.completedWorkouts.length > 0));

  if (!hasActivity(records[cursor])) {
    cursor = shiftDateKey(cursor, -1);
  }

  while (hasActivity(records[cursor])) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function generateDailyTasks(
  shiftHours: ShiftHours,
  conditionLevel: ConditionLevel | null,
  hasWeightToday: boolean
): DailyTask[] {
  const isFatigued = (conditionLevel !== null && conditionLevel <= 2) || shiftHours === 'long';
  const isEnergetic = conditionLevel !== null && conditionLevel >= 4 && shiftHours !== 'long';

  const tasks: DailyTask[] = [];

  if (isFatigued) {
    tasks.push({
      id: 'task_stretch',
      title: 'リカバリー・ストレッチ（5〜10分）',
      subtitle: shiftHours === 'long' ? '長時間シフトの筋疲労を抜く' : '副交感神経を優位にする',
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
      title: '自重筋トレ（スクワット・腕立て）',
      subtitle: '好調な日に筋肥大刺激を入れてStageアップ',
      category: 'strength',
    });
    tasks.push({
      id: 'task_weight',
      title: '体重ログ＆ベース体重チェック',
      subtitle: '目標体重に向けた増量カーブを確認',
      category: 'weight',
    });
    tasks.push({
      id: 'task_cooldown',
      title: 'トレーニング後のケア＆水分補給',
      subtitle: '明日に疲労を残さないリカバリー',
      category: 'recovery',
    });
    return tasks.slice(0, 3);
  }

  // Balanced / Neutral day (Lv.3 or unanswered)
  tasks.push({
    id: 'task_weight',
    title: '毎日の体重記録（食前/食後タグ選択）',
    subtitle: 'ブレを補正したベース体重をトラッキング',
    category: 'weight',
  });
  tasks.push({
    id: 'task_light_move',
    title: shiftHours === 'medium' ? '軽めの体幹プランク＆ストレッチ' : '自重スクワット 15回×2セット',
    subtitle: '無理のない範囲で筋力ベースを維持',
    category: 'strength',
  });
  tasks.push({
    id: 'task_sleep',
    title: '就寝前スマホオフ＆リカバリー睡眠',
    subtitle: '翌朝JST 05:00のリセットに向けて回復',
    category: 'sleep',
  });

  return tasks;
}
