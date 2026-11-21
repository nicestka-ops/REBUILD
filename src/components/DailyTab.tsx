import React from 'react';
import { CheckCircle2, Circle, Flame, ListChecks, ShieldCheck } from 'lucide-react';
import { DailyRecord, ScoreBreakdown, StageInfo } from '../types/rebuild';
import { generateDailyTasks, normalizeConditionLevel } from '../utils/recoveryEngine';

interface DailyTabProps {
  todayRecord: DailyRecord;
  streakDays: number;
  breakdown: ScoreBreakdown;
  stageInfo: StageInfo;
  score: number;
  onToggleTask: (taskId: string) => void;
}

export const DailyTab: React.FC<DailyTabProps> = ({
  todayRecord,
  streakDays,
  breakdown,
  stageInfo,
  score,
  onToggleTask,
}) => {
  const normLevel = normalizeConditionLevel(todayRecord.conditionLevel);
  const tasks = generateDailyTasks(
    todayRecord.shiftHours,
    normLevel,
    todayRecord.rawWeight !== null,
    score
  );

  const completedCount = tasks.filter((t) =>
    todayRecord.completedTasks.includes(t.id)
  ).length;

  return (
    <div className="space-y-4">
      {/* Streak & Cumulative Recovery Summary */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E929B]">
            <Flame className="w-4 h-4 text-[#CCFF00]" />
            <span>継続ストリーク</span>
          </div>
          <div className="font-mono-athletic text-3xl font-black text-white mt-1">
            {streakDays}
            <span className="text-xs font-semibold text-[#8E929B] ml-1">DAYS</span>
          </div>
          <p className="text-[11px] text-[#8E929B] mt-1">
            {streakDays < 5
              ? `CR7解禁まであと ${5 - streakDays}日`
              : streakDays < 10
              ? `GOKU解禁まであと ${10 - streakDays}日`
              : '全ステージ解禁済み ✓'}
          </p>
        </div>

        <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E929B]">
            <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
            <span>累積スコア</span>
          </div>
          <div className="font-mono-athletic text-3xl font-black text-[#CCFF00] mt-1">
            {breakdown.totalScore}
            <span className="text-xs font-semibold text-[#8E929B] ml-1">/100</span>
          </div>
          <p className="text-[11px] text-[#8E929B] mt-1 truncate">
            {stageInfo.code}（1日変動上限 ±8pt）
          </p>
        </div>
      </div>

      {/* Focused Daily Tasks Checklist */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold text-white tracking-wide">
              デイリータスク管理
            </h2>
          </div>
          <span className="font-mono-athletic text-xs font-bold text-[#CCFF00]">
            {completedCount} / {tasks.length} 完了
          </span>
        </div>

        <div className="space-y-2">
          {tasks.map((task) => {
            const done = todayRecord.completedTasks.includes(task.id);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onToggleTask(task.id)}
                className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  done
                    ? 'bg-[#CCFF00]/10 border-[#CCFF00]/45'
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
