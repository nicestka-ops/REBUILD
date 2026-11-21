import React from 'react';
import { CheckCircle2, Compass, Footprints } from 'lucide-react';
import { DailyRecord, RunningRouteType } from '../types/rebuild';
import { getShiftAndConditionPlan } from '../utils/recoveryEngine';
import { RunningCourseMap } from './RunningCourseMap';

interface SpotNavTabProps {
  todayRecord: DailyRecord;
  todayKey: string;
  score: number;
  onSaveRunningDistance: (
    km: number,
    routeType?: RunningRouteType,
    toughPointsCleared?: number,
    markCompletedToday?: boolean
  ) => void;
}

export const SpotNavTab: React.FC<SpotNavTabProps> = ({
  todayRecord,
  todayKey,
  score,
  onSaveRunningDistance,
}) => {
  const plan = getShiftAndConditionPlan(
    todayRecord.shiftHours,
    todayRecord.conditionLevel,
    score
  );
  const completedToday = todayRecord.runningCompletedDateKey === todayKey;
  const actualKm = todayRecord.runningDistanceKm ?? 0;

  return (
    <div className="space-y-4">
      {/* Compact Running Target vs Actual Summary */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold text-white tracking-wide">
              スポットナビ &amp; 安全コース
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-[#CCFF00]/15 border border-[#CCFF00]/30 text-[11px] font-mono-athletic font-bold text-[#CCFF00]">
            {plan.recommendedRunLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#8E929B]">
            <Footprints className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>
              本日の実績:{' '}
              <strong className="font-mono-athletic text-white">
                {actualKm > 0 ? `${actualKm.toFixed(1)} km` : '未記録'}
              </strong>
            </span>
            {todayRecord.runningRouteType && (
              <span className="px-1.5 py-0.5 rounded bg-[#2C2F36] text-[10px] font-bold text-[#CCFF00]">
                {todayRecord.runningRouteType === 'round_trip' ? '往復' : '片道'}
              </span>
            )}
          </div>

          {completedToday && (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#CCFF00]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              達成済み（タスク同期完了）
            </span>
          )}
        </div>
      </div>

      {/* Persistent GPS Safe Running Course Map */}
      <RunningCourseMap
        recommendedRunKm={plan.recommendedRunKm}
        savedDistanceKm={todayRecord.runningDistanceKm}
        initialRouteType={todayRecord.runningRouteType}
        completedToday={completedToday}
        todayKey={todayKey}
        onApplyRunResult={(km, rt, toughCleared, markCompletedToday) => {
          onSaveRunningDistance(km, rt, toughCleared, markCompletedToday);
        }}
      />
    </div>
  );
};
