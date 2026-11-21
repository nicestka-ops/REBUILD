import React, { useState } from 'react';
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  Circle,
  Dumbbell,
  Footprints,
  Scale,
  Briefcase,
} from 'lucide-react';
import {
  ConditionLevel,
  DailyRecord,
  ScoreBreakdown,
  ShiftHours,
  UserProfile,
} from '../types/rebuild';
import {
  CONDITION_OPTIONS,
  generateDailyTasks,
  getShiftAndConditionPlan,
  normalizeConditionLevel,
  SHIFT_OPTIONS,
} from '../utils/recoveryEngine';

interface DashboardTabProps {
  todayRecord: DailyRecord;
  latestWeight: number | null;
  profile: UserProfile;
  breakdown: ScoreBreakdown;
  score: number;
  onSelectCondition: (level: ConditionLevel) => void;
  onSelectShift: (shift: ShiftHours) => void;
  onToggleTask: (taskId: string) => void;
  onOpenWeightModal: () => void;
  onGoToWorkout: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  todayRecord,
  latestWeight,
  profile,
  breakdown,
  score,
  onSelectCondition,
  onSelectShift,
  onToggleTask,
  onOpenWeightModal,
  onGoToWorkout,
}) => {
  const [showConditionPicker, setShowConditionPicker] = useState(false);

  const normLevel = normalizeConditionLevel(todayRecord.conditionLevel);
  const isConditionMissing = normLevel === null;
  const plan = getShiftAndConditionPlan(todayRecord.shiftHours, normLevel, score);
  const tasks = generateDailyTasks(
    todayRecord.shiftHours,
    normLevel,
    todayRecord.rawWeight !== null,
    score
  );

  const activeCondition = CONDITION_OPTIONS.find((c) => c.level === normLevel);

  const weightDiffFromTarget =
    latestWeight !== null
      ? Math.round((latestWeight - profile.targetWeight) * 10) / 10
      : null;

  return (
    <div className="space-y-4">
      {/* JST 05:00 Unanswered Condition Alert Banner (3-level one-tap) */}
      {isConditionMissing && (
        <div className="rounded-2xl bg-[#1C1E22] border-2 border-[#FF3B30] p-4 shadow-[0_0_24px_rgba(255,59,48,0.18)]">
          <div className="flex items-start gap-2.5 mb-3">
            <AlertTriangle className="w-5 h-5 text-[#FF3B30] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-extrabold text-white">
                今日の体調を記録してください
              </p>
              <p className="text-xs text-[#8E929B] mt-0.5">
                JST 05:00 リセット済み・3段階からワンタップで累積スコアに反映
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {CONDITION_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                type="button"
                onClick={() => onSelectCondition(opt.level)}
                className="flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-[#111214] border border-[#2C2F36] hover:border-[#CCFF00] hover:bg-[#CCFF00]/10 transition-all cursor-pointer"
              >
                <span className="text-xs font-extrabold text-white text-center">
                  {opt.label}
                </span>
                <span className="text-[10px] text-[#8E929B] mt-1">
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3 Metric Cards: WEIGHT / STRENGTH / CONDITION */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={onOpenWeightModal}
          className="text-left rounded-2xl bg-[#1C1E22] border border-[#2C2F36] hover:border-[#CCFF00]/60 p-3.5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-widest text-[#8E929B]">
              WEIGHT
            </span>
            <Scale className="w-3.5 h-3.5 text-[#CCFF00]" />
          </div>
          <div className="font-mono-athletic text-xl font-black text-white">
            {latestWeight !== null ? latestWeight.toFixed(1) : '--.-'}
            <span className="text-xs font-semibold text-[#8E929B] ml-0.5">kg</span>
          </div>
          <p className="text-[11px] text-[#8E929B] mt-1 truncate">
            {weightDiffFromTarget !== null
              ? `目標まで ${weightDiffFromTarget >= 0 ? '+' : ''}${weightDiffFromTarget.toFixed(1)}kg`
              : 'タップで記録'}
          </p>
        </button>

        <button
          type="button"
          onClick={onGoToWorkout}
          className="text-left rounded-2xl bg-[#1C1E22] border border-[#2C2F36] hover:border-[#CCFF00]/60 p-3.5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-widest text-[#8E929B]">
              STRENGTH
            </span>
            <Dumbbell className="w-3.5 h-3.5 text-[#CCFF00]" />
          </div>
          <div className="font-mono-athletic text-xl font-black text-white">
            {breakdown.strengthScore}
            <span className="text-xs font-semibold text-[#8E929B] ml-0.5">/30</span>
          </div>
          <p className="text-[11px] text-[#8E929B] mt-1 truncate">
            本日 {todayRecord.completedWorkouts.length} 種目完了
          </p>
        </button>

        <button
          type="button"
          onClick={() => setShowConditionPicker((v) => !v)}
          className={`text-left rounded-2xl bg-[#1C1E22] border p-3.5 transition-colors cursor-pointer ${
            isConditionMissing
              ? 'border-[#FF3B30]/70'
              : 'border-[#2C2F36] hover:border-[#CCFF00]/60'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-widest text-[#8E929B]">
              CONDITION
            </span>
            <Activity
              className={`w-3.5 h-3.5 ${
                isConditionMissing ? 'text-[#FF3B30]' : 'text-[#CCFF00]'
              }`}
            />
          </div>
          <div className="text-lg font-black text-white truncate">
            {activeCondition ? activeCondition.shortLabel : '未回答'}
          </div>
          <p className="text-[11px] text-[#8E929B] mt-1 truncate">
            {activeCondition ? activeCondition.description : 'タップで回答'}
          </p>
        </button>
      </div>

      {/* Inline 3-level Condition Re-picker */}
      {showConditionPicker && !isConditionMissing && (
        <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">体調レベルを変更</span>
            <button
              type="button"
              onClick={() => setShowConditionPicker(false)}
              className="text-xs text-[#8E929B] hover:text-white cursor-pointer"
            >
              閉じる
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CONDITION_OPTIONS.map((opt) => {
              const selected = normLevel === opt.level;
              return (
                <button
                  key={opt.level}
                  type="button"
                  onClick={() => {
                    onSelectCondition(opt.level);
                    setShowConditionPicker(false);
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                    selected
                      ? 'bg-[#CCFF00] border-[#CCFF00] text-black font-extrabold'
                      : 'bg-[#111214] border-[#2C2F36] text-white hover:border-[#CCFF00]/50'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className={`text-[10px] mt-0.5 ${selected ? 'text-black/75' : 'text-[#8E929B]'}`}>
                    {opt.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's Shift Quick Selector + Auto-Generated Tasks */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold tracking-wide text-white">
              TODAY&apos;S REBUILD TASKS
            </h2>
          </div>

          <div className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg border border-[#2C2F36]">
            {SHIFT_OPTIONS.map((s) => {
              const active = todayRecord.shiftHours === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectShift(s.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#CCFF00] text-black'
                      : 'text-[#8E929B] hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shift x Condition Recommended Running Distance Strip */}
        <button
          type="button"
          onClick={onGoToWorkout}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#111214] border border-[#2C2F36] hover:border-[#CCFF00]/50 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Footprints className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
            <span className="text-[11px] font-bold text-[#CCFF00] truncate">
              {plan.recommendedRunLabel}
            </span>
          </div>
          <span className="text-[11px] font-mono-athletic font-bold text-white shrink-0">
            実績: {todayRecord.runningDistanceKm ? `${todayRecord.runningDistanceKm.toFixed(1)} km` : '未記録'}
          </span>
        </button>

        <div className="space-y-2">
          {tasks.map((task) => {
            const done = todayRecord.completedTasks.includes(task.id);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onToggleTask(task.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  done
                    ? 'bg-[#CCFF00]/8 border-[#CCFF00]/40'
                    : 'bg-[#111214] border-[#2C2F36] hover:border-[#3A3E47]'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-[#CCFF00] shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-[#8E929B] shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-bold ${
                      done ? 'line-through text-[#8E929B]' : 'text-white'
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-[#8E929B] mt-0.5">{task.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
