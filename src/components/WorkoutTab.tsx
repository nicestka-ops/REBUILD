import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Dumbbell,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Zap,
} from 'lucide-react';
import { ConditionLevel, ShiftHours, WorkoutExerciseId } from '../types/rebuild';

interface WorkoutTabProps {
  conditionLevel: ConditionLevel | null;
  shiftHours: ShiftHours;
  completedWorkouts: WorkoutExerciseId[];
  onToggleWorkout: (id: WorkoutExerciseId) => void;
}

interface ExerciseItem {
  id: WorkoutExerciseId;
  name: string;
  enName: string;
  target: string;
  repsLabel: string;
  defaultSeconds: number;
}

const EXERCISES: ExerciseItem[] = [
  {
    id: 'squat',
    name: 'スクワット',
    enName: 'BODYWEIGHT SQUAT',
    target: '下半身・基礎代謝',
    repsLabel: '15回 × 2〜3セット',
    defaultSeconds: 45,
  },
  {
    id: 'pushup',
    name: '腕立て伏せ',
    enName: 'PUSH-UP',
    target: '胸・肩・体幹',
    repsLabel: '10〜15回 × 2〜3セット',
    defaultSeconds: 40,
  },
  {
    id: 'plank',
    name: 'プランク',
    enName: 'FRONT PLANK',
    target: '腹圧・姿勢安定',
    repsLabel: '30〜60秒 × 2セット',
    defaultSeconds: 45,
  },
  {
    id: 'stretch',
    name: '全身ストレッチ',
    enName: 'RECOVERY STRETCH',
    target: '疲労抜き・可動域',
    repsLabel: '各部位 30秒',
    defaultSeconds: 60,
  },
];

function playBeep(freq: number = 880, durationMs: number = 140) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
  onToggleWorkout,
}) => {
  // Timer state
  const [mode, setMode] = useState<'countdown' | 'interval'>('interval');
  const [workSec, setWorkSec] = useState<number>(40);
  const [restSec, setRestSec] = useState<number>(15);
  const [totalSets, setTotalSets] = useState<number>(3);

  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [currentSet, setCurrentSet] = useState<number>(1);
  const [secondsLeft, setSecondsLeft] = useState<number>(40);
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

        // Time hit 0
        if (mode === 'countdown') {
          playBeep(1046, 260);
          setIsRunning(false);
          return 0;
        }

        // Interval mode transition
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
  const progressPct = maxDuration > 0 ? Math.round(((maxDuration - secondsLeft) / maxDuration) * 100) : 0;

  // Recommended menu based on condition & shift
  const isFatigued = (conditionLevel !== null && conditionLevel <= 2) || shiftHours === 'long';
  const isPeak = conditionLevel !== null && conditionLevel >= 4 && shiftHours !== 'long';

  const recommendation = isFatigued
    ? {
        badge: 'RECOVERY FOCUS',
        title: '疲労回復優先メニュー',
        desc: '今日は無理に追い込まず「全身ストレッチ」と軽い「プランク」で血流を促しましょう。',
        recommendedIds: ['stretch', 'plank'] as WorkoutExerciseId[],
      }
    : isPeak
    ? {
        badge: 'BUILD & GAIN',
        title: '筋力リビルド強化メニュー',
        desc: '好調なコンディションです！「スクワット」「腕立て伏せ」「プランク」で筋量とStageを引き上げましょう。',
        recommendedIds: ['squat', 'pushup', 'plank'] as WorkoutExerciseId[],
      }
    : {
        badge: 'BALANCED',
        title: '基礎コンディション維持メニュー',
        desc: 'スクワット＋ストレッチの組み合わせで、筋力維持と疲労ケアを両立しましょう。',
        recommendedIds: ['squat', 'stretch'] as WorkoutExerciseId[],
      };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-4">
      {/* Condition-Aware Recommendation Card */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest text-[#CCFF00]">
            <Zap className="w-3.5 h-3.5" />
            {recommendation.badge}
          </span>
          <span className="text-[11px] font-semibold text-[#8E929B]">
            体調 {conditionLevel ? `Lv.${conditionLevel}` : '未回答'}
          </span>
        </div>
        <h2 className="text-base font-extrabold text-white">{recommendation.title}</h2>
        <p className="text-xs text-[#8E929B] mt-1 leading-relaxed">{recommendation.desc}</p>
      </div>

      {/* Countdown & Interval Timer */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#CCFF00]" />
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              INTERVAL &amp; COUNTDOWN TIMER
            </h3>
          </div>
          <div className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg border border-[#2C2F36]">
            <button
              type="button"
              onClick={() => applyPreset(40, 15, 'interval')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                mode === 'interval' ? 'bg-[#CCFF00] text-black' : 'text-[#8E929B]'
              }`}
            >
              インターバル
            </button>
            <button
              type="button"
              onClick={() => applyPreset(45, 0, 'countdown')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                mode === 'countdown' ? 'bg-[#CCFF00] text-black' : 'text-[#8E929B]'
              }`}
            >
              カウントダウン
            </button>
          </div>
        </div>

        {/* Big Timer Display */}
        <div className="rounded-xl bg-[#111214] border border-[#2C2F36] p-4 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[11px] font-extrabold tracking-widest px-2 py-0.5 rounded ${
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
          </div>

          <div className="font-mono-athletic text-5xl font-black tracking-tight text-white my-1">
            {mins}:{secs}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-[#2C2F36] rounded-full overflow-hidden mt-2">
            <div
              className={`h-full transition-all duration-300 ${
                phase === 'work' ? 'bg-[#CCFF00]' : 'bg-[#FF3B30]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Presets & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {[
              { label: '30s', w: 30, r: 15 },
              { label: '45s', w: 45, r: 15 },
              { label: '60s', w: 60, r: 20 },
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

      {/* Exercise Completion Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-[#CCFF00]" />
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              EXERCISES（種目別完了）
            </h3>
          </div>
          <span className="text-xs font-mono-athletic text-[#CCFF00] font-bold">
            {completedWorkouts.length} / {EXERCISES.length} DONE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {EXERCISES.map((ex) => {
            const done = completedWorkouts.includes(ex.id);
            const isRecommended = recommendation.recommendedIds.includes(ex.id);
            return (
              <div
                key={ex.id}
                className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                  done
                    ? 'bg-[#CCFF00]/10 border-[#CCFF00]/60'
                    : 'bg-[#1C1E22] border-[#2C2F36]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
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
                    <h4 className="text-base font-extrabold text-white mt-0.5">
                      {ex.name}
                    </h4>
                    <p className="text-xs text-[#8E929B] mt-0.5">
                      {ex.target} ・ {ex.repsLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset(ex.defaultSeconds, 15, mode)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#111214] border border-[#2C2F36] text-[11px] font-bold text-[#8E929B] hover:text-white cursor-pointer"
                  >
                    タイマー {ex.defaultSeconds}s
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
