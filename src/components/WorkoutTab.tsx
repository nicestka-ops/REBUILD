import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Dumbbell,
  Footprints,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Zap,
} from 'lucide-react';
import { ConditionLevel, ShiftHours, WorkoutExerciseId } from '../types/rebuild';
import { normalizeConditionLevel } from '../utils/recoveryEngine';

interface WorkoutTabProps {
  conditionLevel: ConditionLevel | number | null;
  shiftHours: ShiftHours;
  completedWorkouts: WorkoutExerciseId[];
  runningDistanceKm: number | null | undefined;
  onToggleWorkout: (id: WorkoutExerciseId) => void;
  onSaveRunningDistance: (km: number) => void;
}

type CategoryId = 'pushup' | 'abs' | 'stretch' | 'running';

interface ExerciseItem {
  id: WorkoutExerciseId;
  category: CategoryId;
  name: string;
  enName: string;
  target: string;
  repsLabel: string;
  defaultSeconds: number;
}

const CATEGORY_TABS: { id: 'all' | CategoryId; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'pushup', label: '腕立て' },
  { id: 'abs', label: '腹筋' },
  { id: 'stretch', label: 'ストレッチ' },
  { id: 'running', label: 'ランニング' },
];

const EXERCISES: ExerciseItem[] = [
  // 腕立て伏せ
  {
    id: 'pushup_normal',
    category: 'pushup',
    name: 'ノーマル腕立て伏せ',
    enName: 'STANDARD PUSH-UP',
    target: '胸・肩・二の腕',
    repsLabel: '10〜15回 × 2〜3セット',
    defaultSeconds: 45,
  },
  {
    id: 'pushup_knee',
    category: 'pushup',
    name: '膝つき・スロー腕立て伏せ',
    enName: 'KNEE / SLOW PUSH-UP',
    target: '疲労時向け・フォーム重視',
    repsLabel: '10回 × 2セット（3秒かけて下ろす）',
    defaultSeconds: 45,
  },
  // 腹筋
  {
    id: 'abs_crunch',
    category: 'abs',
    name: 'クランチ',
    enName: 'AB CRUNCH',
    target: '腹直筋上部',
    repsLabel: '15〜20回 × 2〜3セット',
    defaultSeconds: 40,
  },
  {
    id: 'abs_legraise',
    category: 'abs',
    name: 'レッグレイズ',
    enName: 'LEG RAISE',
    target: '下腹部・腸腰筋',
    repsLabel: '12〜15回 × 2セット',
    defaultSeconds: 40,
  },
  {
    id: 'abs_plank',
    category: 'abs',
    name: 'プランク',
    enName: 'FRONT PLANK',
    target: '体幹・姿勢安定（秒数タイマー）',
    repsLabel: '30〜60秒 × 2セット',
    defaultSeconds: 45,
  },
  // ストレッチ
  {
    id: 'stretch_shift',
    category: 'stretch',
    name: 'バイト後リカバリーストレッチ',
    enName: 'POST-SHIFT RECOVERY',
    target: '腰・ふくらはぎ・肩の疲労抜き',
    repsLabel: '2〜3分（各部位30秒）',
    defaultSeconds: 120,
  },
  {
    id: 'stretch_sleep',
    category: 'stretch',
    name: '就寝前リラックスストレッチ',
    enName: 'PRE-SLEEP RELAX',
    target: '副交感神経・深い睡眠',
    repsLabel: '3分（深呼吸しながら）',
    defaultSeconds: 180,
  },
  {
    id: 'stretch_shoulder',
    category: 'stretch',
    name: '肩・腰ほぐしストレッチ',
    enName: 'SHOULDER & BACK MOBILITY',
    target: '立ち仕事・前傾疲労のリセット',
    repsLabel: '2分（ゆっくり呼吸）',
    defaultSeconds: 120,
  },
  {
    id: 'stretch_morning',
    category: 'stretch',
    name: '起床後ストレッチ',
    enName: 'MORNING MOBILITY',
    target: '血流促進・朝の目覚め',
    repsLabel: '1〜2分（全身伸ばし）',
    defaultSeconds: 60,
  },
  // ランニング
  {
    id: 'running_jog',
    category: 'running',
    name: '軽いジョギング',
    enName: 'LIGHT JOGGING',
    target: '心肺機能・リズム回復',
    repsLabel: '1〜2km（会話できるペース）',
    defaultSeconds: 180,
  },
  {
    id: 'running_goal',
    category: 'running',
    name: 'ランニング（距離目標チャレンジ）',
    enName: 'GOAL RUN',
    target: '持久力・全身ビルド',
    repsLabel: '2〜5km（下の記録欄に入力）',
    defaultSeconds: 180,
  },
];

function playBeep(freq: number = 880, durationMs: number = 140) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Ignore audio context restrictions
  }
}

export const WorkoutTab: React.FC<WorkoutTabProps> = ({
  conditionLevel,
  shiftHours,
  completedWorkouts,
  runningDistanceKm,
  onToggleWorkout,
  onSaveRunningDistance,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | CategoryId>('all');
  const [runInput, setRunInput] = useState<string>(
    (runningDistanceKm ?? 2.0).toFixed(1)
  );
  const [runSavedFlash, setRunSavedFlash] = useState(false);

  const [mode, setMode] = useState<'countdown' | 'interval'>('countdown');
  const [workSec, setWorkSec] = useState<number>(45);
  const [restSec, setRestSec] = useState<number>(15);
  const [totalSets, setTotalSets] = useState<number>(3);

  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [currentSet, setCurrentSet] = useState<number>(1);
  const [secondsLeft, setSecondsLeft] = useState<number>(45);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        if (mode === 'countdown') {
          playBeep(1046, 260);
          setIsRunning(false);
          return 0;
        }

        if (phase === 'work') {
          if (currentSet >= totalSets) {
            playBeep(1046, 300);
            setIsRunning(false);
            return 0;
          }
          playBeep(660, 180);
          setPhase('rest');
          return restSec;
        } else {
          playBeep(880, 180);
          setPhase('work');
          setCurrentSet((s) => s + 1);
          return workSec;
        }
      });
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, mode, phase, currentSet, totalSets, workSec, restSec]);

  const resetTimer = (nextWorkSec = workSec) => {
    setIsRunning(false);
    setPhase('work');
    setCurrentSet(1);
    setSecondsLeft(nextWorkSec);
  };

  const applyPreset = (w: number, r: number, m: 'countdown' | 'interval') => {
    setMode(m);
    setWorkSec(w);
    setRestSec(r);
    setIsRunning(false);
    setPhase('work');
    setCurrentSet(1);
    setSecondsLeft(w);
  };

  const maxDuration = phase === 'work' ? workSec : restSec;
  const progressPct =
    maxDuration > 0 ? Math.round(((maxDuration - secondsLeft) / maxDuration) * 100) : 0;

  const norm = normalizeConditionLevel(conditionLevel);
  const isFatigued = norm === 1 || shiftHours === 'long';
  const isPeak = norm === 3 && shiftHours !== 'long';

  const recommendation = isFatigued
    ? {
        badge: 'RECOVERY CARE MODE',
        title: '【リカバリー・ケアモード】ストレッチ中心',
        desc: '不調・疲労の日は減点されません。無理な筋トレやランニングは避け、バイト後・就寝前・肩腰ストレッチで体をほぐしましょう。',
        recommendedIds: ['stretch_shift', 'stretch_sleep', 'stretch_shoulder'] as WorkoutExerciseId[],
      }
    : isPeak
    ? {
        badge: 'POWER & RUNNING MODE',
        title: '【強化・ランニングモード】しっかり動く',
        desc: '好調なコンディションです！腕立て伏せ（回数チャレンジ）、腹筋（レッグレイズ/プランク）、ランニング（距離目標）でギアを上げましょう。',
        recommendedIds: ['pushup_normal', 'abs_legraise', 'abs_plank', 'running_goal'] as WorkoutExerciseId[],
      }
    : {
        badge: 'BALANCE MODE',
        title: '【バランス維持モード】腕立て・腹筋・軽ジョグ',
        desc: '腕立て伏せ（ノーマル/膝つき）、腹筋（クランチ/プランク）、軽いジョギングからバランス良く取り組みましょう。',
        recommendedIds: ['pushup_knee', 'abs_crunch', 'abs_plank', 'running_jog'] as WorkoutExerciseId[],
      };

  const filteredExercises =
    selectedCategory === 'all'
      ? EXERCISES
      : EXERCISES.filter((e) => e.category === selectedCategory);

  const parsedKm = parseFloat(runInput);
  const isValidKm = !Number.isNaN(parsedKm) && parsedKm >= 0.1 && parsedKm <= 50;

  const stepRunKm = (delta: number) => {
    const base = isValidKm ? parsedKm : 1.0;
    const next = Math.max(0.1, Math.min(50, Math.round((base + delta) * 10) / 10));
    setRunInput(next.toFixed(1));
  };

  const handleSaveRun = () => {
    if (!isValidKm) return;
    onSaveRunningDistance(Math.round(parsedKm * 10) / 10);
    setRunSavedFlash(true);
    window.setTimeout(() => setRunSavedFlash(false), 1800);
  };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-4">
      {/* 3-Level Condition-Aware Recommendation Card */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest text-[#CCFF00]">
            <Zap className="w-3.5 h-3.5" />
            {recommendation.badge}
          </span>
          <span className="text-[11px] font-semibold text-[#8E929B]">
            体調: {norm === 1 ? '不調・疲れ気味' : norm === 2 ? '普通' : norm === 3 ? '好調' : '未回答'}
          </span>
        </div>
        <h2 className="text-base font-extrabold text-white">{recommendation.title}</h2>
        <p className="text-xs text-[#8E929B] mt-1 leading-relaxed">{recommendation.desc}</p>
      </div>

      {/* Running Distance (km) Recorder */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className="w-4 h-4 text-[#CCFF00]" />
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              ランニング走行距離（km）
            </h3>
          </div>
          {runningDistanceKm ? (
            <span className="text-[11px] font-mono-athletic font-bold text-[#CCFF00]">
              本日: {runningDistanceKm.toFixed(1)} km
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 bg-[#111214] border border-[#2C2F36] rounded-xl p-2.5">
          <button
            type="button"
            onClick={() => stepRunKm(-0.1)}
            className="w-11 h-10 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-white font-bold text-sm hover:border-[#CCFF00]/60 cursor-pointer"
          >
            -0.1
          </button>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="50"
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              className="w-20 bg-transparent text-center font-mono-athletic text-2xl font-black text-white focus:outline-none"
            />
            <span className="text-xs font-semibold text-[#8E929B]">km</span>
          </div>
          <button
            type="button"
            onClick={() => stepRunKm(0.1)}
            className="w-11 h-10 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-white font-bold text-sm hover:border-[#CCFF00]/60 cursor-pointer"
          >
            +0.1
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 5].map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setRunInput(km.toFixed(1))}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-athletic font-bold border cursor-pointer ${
                  Math.abs((parsedKm || 0) - km) < 0.05
                    ? 'border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/10'
                    : 'border-[#2C2F36] text-[#8E929B] bg-[#111214] hover:text-white'
                }`}
              >
                {km}km
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!isValidKm}
            onClick={handleSaveRun}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CCFF00] text-black font-extrabold text-xs hover:brightness-105 disabled:opacity-40 cursor-pointer"
          >
            {runSavedFlash ? (
              <>
                <Check className="w-4 h-4" />
                <span>記録しました</span>
              </>
            ) : (
              <span>走行距離を保存</span>
            )}
          </button>
        </div>
      </div>

      {/* Countdown & Interval Timer */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#CCFF00]" />
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              WORKOUT &amp; STRETCH TIMER
            </h3>
          </div>
          <div className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg border border-[#2C2F36]">
            <button
              type="button"
              onClick={() => applyPreset(45, 0, 'countdown')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                mode === 'countdown' ? 'bg-[#CCFF00] text-black' : 'text-[#8E929B]'
              }`}
            >
              カウントダウン
            </button>
            <button
              type="button"
              onClick={() => applyPreset(40, 15, 'interval')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                mode === 'interval' ? 'bg-[#CCFF00] text-black' : 'text-[#8E929B]'
              }`}
            >
              インターバル
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-[#111214] border border-[#2C2F36] p-4 flex flex-col items-center">
          <span
            className={`text-[11px] font-extrabold tracking-widest px-2 py-0.5 rounded mb-1 ${
              phase === 'work'
                ? 'bg-[#CCFF00]/15 text-[#CCFF00]'
                : 'bg-[#FF3B30]/15 text-[#FF3B30]'
            }`}
          >
            {mode === 'interval'
              ? phase === 'work'
                ? `WORK // SET ${currentSet}/${totalSets}`
                : `REST // NEXT SET ${Math.min(totalSets, currentSet + 1)}`
              : 'COUNTDOWN'}
          </span>

          <div className="font-mono-athletic text-5xl font-black tracking-tight text-white my-1">
            {mins}:{secs}
          </div>

          <div className="w-full h-1.5 bg-[#2C2F36] rounded-full overflow-hidden mt-2">
            <div
              className={`h-full transition-all duration-300 ${
                phase === 'work' ? 'bg-[#CCFF00]' : 'bg-[#FF3B30]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: '30s', w: 30, r: 15 },
              { label: '45s', w: 45, r: 15 },
              { label: '60s', w: 60, r: 20 },
              { label: '2分', w: 120, r: 20 },
              { label: '3分', w: 180, r: 20 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.w, p.r, mode)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-athletic font-bold border cursor-pointer ${
                  workSec === p.w
                    ? 'border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/10'
                    : 'border-[#2C2F36] text-[#8E929B] bg-[#111214] hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
            {mode === 'interval' && (
              <button
                type="button"
                onClick={() => setTotalSets((s) => (s >= 5 ? 2 : s + 1))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono-athletic font-bold border border-[#2C2F36] text-[#8E929B] bg-[#111214] hover:text-white cursor-pointer"
              >
                {totalSets}SET
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => resetTimer(workSec)}
              className="p-2.5 rounded-xl bg-[#111214] border border-[#2C2F36] text-[#8E929B] hover:text-white cursor-pointer"
              aria-label="Reset timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (secondsLeft === 0) resetTimer(workSec);
                setIsRunning((r) => !r);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#CCFF00] text-black font-extrabold text-xs tracking-wide hover:brightness-105 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 fill-black" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black" />
                  <span>START</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter + Exercise Completion Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-[#CCFF00]" />
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              EXERCISES（腕立て・腹筋・ストレッチ・ランニング）
            </h3>
          </div>
          <span className="text-xs font-mono-athletic text-[#CCFF00] font-bold">
            {completedWorkouts.length} / {EXERCISES.length} DONE
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1 bg-[#1C1E22] p-1 rounded-xl border border-[#2C2F36]">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#CCFF00] text-black'
                  : 'text-[#8E929B] hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredExercises.map((ex) => {
            const done = completedWorkouts.includes(ex.id);
            const isRecommended = recommendation.recommendedIds.includes(ex.id);
            const timerLabel =
              ex.defaultSeconds >= 60 ? `${ex.defaultSeconds / 60}分` : `${ex.defaultSeconds}s`;
            return (
              <div
                key={ex.id}
                className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                  done
                    ? 'bg-[#CCFF00]/10 border-[#CCFF00]/60'
                    : 'bg-[#1C1E22] border-[#2C2F36]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-widest text-[#8E929B]">
                      {ex.enName}
                    </span>
                    {isRecommended && (
                      <span className="px-1.5 py-0.5 rounded bg-[#CCFF00]/15 text-[#CCFF00] text-[9px] font-extrabold">
                        推奨
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-extrabold text-white mt-0.5">{ex.name}</h4>
                  <p className="text-xs text-[#8E929B] mt-0.5">
                    {ex.target} ・ {ex.repsLabel}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset(ex.defaultSeconds, 15, 'countdown')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#111214] border border-[#2C2F36] text-[11px] font-bold text-[#8E929B] hover:text-white cursor-pointer"
                  >
                    タイマー {timerLabel}
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleWorkout(ex.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      done
                        ? 'bg-[#CCFF00] text-black'
                        : 'bg-[#111214] border border-[#2C2F36] text-white hover:border-[#CCFF00]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{done ? '完了済み' : '完了にする'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
