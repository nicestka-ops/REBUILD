import React, { useMemo, useState } from 'react';
import { CalendarPlus, Footprints, TrendingUp } from 'lucide-react';
import { DailyRecord, UserProfile } from '../types/rebuild';
import { formatShortDate, getPastDateKeys } from '../utils/dateJst';
import { calculateScoreBreakdown } from '../utils/recoveryEngine';

interface TrendTabProps {
  todayKey: string;
  records: Record<string, DailyRecord>;
  profile: UserProfile;
  onOpenWeightModal?: () => void;
}

export const TrendTab: React.FC<TrendTabProps> = ({
  todayKey,
  records,
  profile,
  onOpenWeightModal,
}) => {
  const [range, setRange] = useState<'week' | 'month'>('week');

  const chartData = useMemo(() => {
    const days = range === 'week' ? 7 : 30;
    const keys = getPastDateKeys(todayKey, days);
    return keys.map((k) => {
      const rec = records[k];
      const score = calculateScoreBreakdown(records, profile, k).totalScore;
      return {
        dateKey: k,
        label: formatShortDate(k),
        rawWeight: rec?.rawWeight ?? null,
        normalizedWeight: rec?.normalizedWeight ?? null,
        score,
        runningDistanceKm: rec?.runningDistanceKm ?? 0,
      };
    });
  }, [range, todayKey, records, profile]);

  const periodTotalKm = useMemo(
    () =>
      Number(
        chartData.reduce((acc, d) => acc + (d.runningDistanceKm || 0), 0).toFixed(1)
      ),
    [chartData]
  );

  const allTimeTotalKm = useMemo(
    () =>
      Number(
        Object.values(records)
          .reduce((acc, rec) => acc + (rec.runningDistanceKm ?? 0), 0)
          .toFixed(1)
      ),
    [records]
  );

  const maxRunKm = useMemo(
    () => Math.max(5, ...chartData.map((d) => d.runningDistanceKm || 0)),
    [chartData]
  );

  const svgW = 560;
  const svgH = 230;
  const padL = 38;
  const padR = 34;
  const padT = 18;
  const padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const weightValues = chartData
    .flatMap((d) => [d.normalizedWeight, d.rawWeight])
    .filter((v): v is number => v !== null);

  const minW = weightValues.length > 0 ? Math.floor(Math.min(...weightValues) - 1) : 50;
  const maxW = weightValues.length > 0 ? Math.ceil(Math.max(...weightValues) + 1) : 65;
  const spanW = Math.max(2, maxW - minW);

  const getX = (idx: number) =>
    chartData.length <= 1 ? padL + plotW / 2 : padL + (idx / (chartData.length - 1)) * plotW;

  const getWeightY = (w: number) => padT + (1 - (w - minW) / spanW) * plotH;
  const getScoreY = (s: number) => padT + (1 - s / 100) * plotH;

  const normPoints = chartData
    .map((d, i) =>
      d.normalizedWeight !== null
        ? { x: getX(i), y: getWeightY(d.normalizedWeight), val: d.normalizedWeight }
        : null
    )
    .filter((p): p is { x: number; y: number; val: number } => p !== null);

  const normPath =
    normPoints.length > 0
      ? normPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  const scorePath = chartData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getScoreY(d.score).toFixed(1)}`)
    .join(' ');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold text-white tracking-wide">
              WEIGHT &amp; SCORE TREND
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenWeightModal && (
              <button
                type="button"
                onClick={onOpenWeightModal}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#111214] border border-[#CCFF00]/40 text-[11px] font-bold text-[#CCFF00] hover:bg-[#CCFF00]/10 cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>過去日も登録</span>
              </button>
            )}

          <div className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg border border-[#2C2F36]">
            <button
              type="button"
              onClick={() => setRange('week')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                range === 'week' ? 'bg-[#CCFF00] text-black' : 'text-[#8E929B]'
              }`}
            >
              週間 (7D)
            </button>
            <button
              type="button"
              onClick={() => setRange('month')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                range === 'month' ? 'bg-[#CCFF00] text-black' : 'text-[#8E929B]'
              }`}
            >
              月間 (30D)
            </button>
          </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#8E929B]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#CCFF00] inline-block" />
            <span>ベース体重（実線）</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-white bg-[#111214] inline-block" />
            <span>実測値（ドット）</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t border-dashed border-[#8E929B] inline-block" />
            <span>累積スコア (0-100)</span>
          </span>
        </div>

        <div className="w-full overflow-hidden rounded-xl bg-[#111214] border border-[#2C2F36] p-2">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto block">
            {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
              const y = padT + t * plotH;
              const wVal = (maxW - t * spanW).toFixed(1);
              const sVal = Math.round((1 - t) * 100);
              return (
                <g key={idx}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={svgW - padR}
                    y2={y}
                    stroke="#2C2F36"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="#8E929B"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {wVal}
                  </text>
                  <text
                    x={svgW - padR + 6}
                    y={y + 3}
                    textAnchor="start"
                    fill="#6B7280"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {sVal}pt
                  </text>
                </g>
              );
            })}

            {profile.targetWeight >= minW && profile.targetWeight <= maxW && (
              <line
                x1={padL}
                y1={getWeightY(profile.targetWeight)}
                x2={svgW - padR}
                y2={getWeightY(profile.targetWeight)}
                stroke="rgba(204,255,0,0.28)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            )}

            <path
              d={scorePath}
              fill="none"
              stroke="#8E929B"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.7"
            />

            {normPath && (
              <path
                d={normPath}
                fill="none"
                stroke="#CCFF00"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {chartData.map((d, i) => {
              const x = getX(i);
              return (
                <g key={d.dateKey}>
                  {d.rawWeight !== null && (
                    <circle
                      cx={x}
                      cy={getWeightY(d.rawWeight)}
                      r={range === 'week' ? 4 : 2.8}
                      fill="#111214"
                      stroke="#FFFFFF"
                      strokeWidth="1.8"
                    />
                  )}
                  {d.normalizedWeight !== null && (
                    <circle
                      cx={x}
                      cy={getWeightY(d.normalizedWeight)}
                      r={range === 'week' ? 3.5 : 2.3}
                      fill="#CCFF00"
                    />
                  )}
                </g>
              );
            })}

            {chartData.map((d, i) => {
              const showLabel =
                range === 'week' || i === 0 || i === chartData.length - 1 || i % 5 === 0;
              if (!showLabel) return null;
              return (
                <text
                  key={d.dateKey}
                  x={getX(i)}
                  y={svgH - 6}
                  textAnchor="middle"
                  fill="#8E929B"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {d.label}
                </text>
              );
            })}
          </svg>
        </div>

        <p className="text-[11px] text-[#8E929B]">
          目標体重: <span className="font-mono-athletic text-white font-bold">{profile.targetWeight.toFixed(1)}kg</span>
          {' / '}
          開始基準: <span className="font-mono-athletic text-white font-bold">{profile.baselineWeight.toFixed(1)}kg</span>
        </p>
      </div>

      {/* 累計走行距離 & 日別の走行距離 */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Footprints className="w-4 h-4 text-[#CCFF00]" />
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              RUNNING DISTANCE
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[#8E929B]">
              {range === 'week' ? '7日間' : '30日間'}:{' '}
              <strong className="font-mono-athletic text-white">{periodTotalKm.toFixed(1)} km</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-[#CCFF00]/15 border border-[#CCFF00]/30 text-[#CCFF00] font-mono-athletic font-bold">
              累計 {allTimeTotalKm.toFixed(1)} km
            </span>
          </div>
        </div>

        <div className="bg-[#111214] rounded-xl p-3 border border-[#2C2F36]">
          <div className="flex items-end gap-1.5 h-24">
            {chartData.map((d) => {
              const km = d.runningDistanceKm || 0;
              const pct = km > 0 ? Math.max(8, Math.round((km / maxRunKm) * 100)) : 0;
              return (
                <div key={d.dateKey} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                  {km > 0 && range === 'week' && (
                    <span className="text-[10px] font-mono-athletic text-[#CCFF00] mb-1">
                      {km.toFixed(1)}
                    </span>
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${
                      km > 0 ? 'bg-[#CCFF00]' : 'bg-[#252830] h-[2px]'
                    }`}
                    style={km > 0 ? { height: `${pct}%` } : undefined}
                    title={`${d.label}: ${km.toFixed(1)} km`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {chartData.map((d, i) => {
              const showLabel =
                range === 'week' || i === 0 || i === chartData.length - 1 || i % 5 === 0;
              return (
                <div
                  key={d.dateKey}
                  className="flex-1 text-center text-[9px] font-mono-athletic text-[#8E929B] truncate"
                >
                  {showLabel ? d.label : ''}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
