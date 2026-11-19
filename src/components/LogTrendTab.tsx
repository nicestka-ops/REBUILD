import React, { useMemo, useState } from 'react';
import { Briefcase, Check, RotateCcw, Scale, TrendingUp } from 'lucide-react';
import {
  DailyRecord,
  ShiftHours,
  UserProfile,
  WeightTiming,
} from '../types/rebuild';
import { formatShortDate, getPastDateKeys } from '../utils/dateJst';
import {
  calculateScoreBreakdown,
  computeNormalizedWeight,
  SHIFT_OPTIONS,
  WEIGHT_TIMING_OPTIONS,
} from '../utils/recoveryEngine';

interface LogTrendTabProps {
  todayKey: string;
  todayRecord: DailyRecord;
  records: Record<string, DailyRecord>;
  profile: UserProfile;
  latestWeight: number | null;
  onSelectShift: (shift: ShiftHours) => void;
  onSaveWeight: (rawWeight: number, timing: WeightTiming) => void;
  onResetDemo: () => void;
}

export const LogTrendTab: React.FC<LogTrendTabProps> = ({
  todayKey,
  todayRecord,
  records,
  profile,
  latestWeight,
  onSelectShift,
  onSaveWeight,
  onResetDemo,
}) => {
  const initialWeight = todayRecord.rawWeight ?? latestWeight ?? profile.baselineWeight;
  const [rawInput, setRawInput] = useState<string>(initialWeight.toFixed(1));
  const [timing, setTiming] = useState<WeightTiming>(todayRecord.weightTiming ?? 'fasted');
  const [savedFlash, setSavedFlash] = useState(false);
  const [range, setRange] = useState<'week' | 'month'>('week');

  const parsed = parseFloat(rawInput);
  const isValid = !Number.isNaN(parsed) && parsed >= 30 && parsed <= 180;
  const previewNormalized = isValid ? computeNormalizedWeight(parsed, timing) : null;

  const stepWeight = (delta: number) => {
    const base = isValid ? parsed : initialWeight;
    const next = Math.max(30, Math.min(180, Math.round((base + delta) * 10) / 10));
    setRawInput(next.toFixed(1));
  };

  const handleSave = () => {
    if (!isValid) return;
    onSaveWeight(Math.round(parsed * 10) / 10, timing);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  // Build chart data points
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
      };
    });
  }, [range, todayKey, records, profile]);

  // SVG Chart dimensions & scales
  const svgW = 560;
  const svgH = 220;
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

  // Build SVG path for normalizedWeight (connect available points)
  const normPoints = chartData
    .map((d, i) => (d.normalizedWeight !== null ? { x: getX(i), y: getWeightY(d.normalizedWeight), val: d.normalizedWeight } : null))
    .filter((p): p is { x: number; y: number; val: number } => p !== null);

  const normPath =
    normPoints.length > 0
      ? normPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  // Build SVG path for score
  const scorePath = chartData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getScoreY(d.score).toFixed(1)}`)
    .join(' ');

  return (
    <div className="space-y-4">
      {/* Shift Hours Selector */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold text-white tracking-wide">
              今日のアルバイト時間
            </h2>
          </div>
          <span className="text-[11px] text-[#8E929B]">タスク提案に連動</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {SHIFT_OPTIONS.map((opt) => {
            const active = todayRecord.shiftHours === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectShift(opt.id)}
                className={`py-2.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                  active
                    ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                    : 'bg-[#111214] border-[#2C2F36] text-white hover:border-[#3E424B]'
                }`}
              >
                <div className="text-xs font-extrabold">{opt.label}</div>
                <div className={`text-[10px] mt-0.5 ${active ? 'text-black/75 font-bold' : 'text-[#8E929B]'}`}>
                  {opt.loadLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Weight Input Form with Timing Tags */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold text-white tracking-wide">
              体重記録（食前・食後補正）
            </h2>
          </div>
          {todayRecord.normalizedWeight !== null && (
            <span className="text-[11px] font-mono-athletic font-bold text-[#CCFF00]">
              本日保存済: {todayRecord.normalizedWeight.toFixed(1)}kg
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 bg-[#111214] border border-[#2C2F36] rounded-xl p-2.5">
          <button
            type="button"
            onClick={() => stepWeight(-0.1)}
            className="w-11 h-10 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-white font-bold text-sm hover:border-[#CCFF00]/60 cursor-pointer"
          >
            -0.1
          </button>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              step="0.1"
              min="30"
              max="180"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="w-24 bg-transparent text-center font-mono-athletic text-2xl font-black text-white focus:outline-none"
            />
            <span className="text-xs font-semibold text-[#8E929B]">kg（実測）</span>
          </div>
          <button
            type="button"
            onClick={() => stepWeight(0.1)}
            className="w-11 h-10 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-white font-bold text-sm hover:border-[#CCFF00]/60 cursor-pointer"
          >
            +0.1
          </button>
        </div>

        {/* 3 Timing Tags */}
        <div className="grid grid-cols-3 gap-2">
          {WEIGHT_TIMING_OPTIONS.map((opt) => {
            const active = timing === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTiming(opt.id)}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  active
                    ? 'bg-[#CCFF00]/12 border-[#CCFF00] text-white'
                    : 'bg-[#111214] border-[#2C2F36] text-[#8E929B] hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold leading-tight">{opt.label}</div>
                <div
                  className={`font-mono-athletic text-[11px] font-extrabold mt-1 ${
                    active ? 'text-[#CCFF00]' : 'text-[#8E929B]'
                  }`}
                >
                  {opt.badge}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-[#8E929B]">
            ベース体重:{' '}
            <span className="font-mono-athletic text-sm font-extrabold text-[#CCFF00]">
              {previewNormalized !== null ? `${previewNormalized.toFixed(1)} kg` : '--.- kg'}
            </span>
          </div>
          <button
            type="button"
            disabled={!isValid}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#CCFF00] text-black font-extrabold text-xs tracking-wide hover:brightness-105 disabled:opacity-40 cursor-pointer"
          >
            {savedFlash ? (
              <>
                <Check className="w-4 h-4" />
                <span>記録しました</span>
              </>
            ) : (
              <span>体重を保存</span>
            )}
          </button>
        </div>
      </div>

      {/* Weight & Score Trend Chart */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold text-white tracking-wide">
              WEIGHT &amp; SCORE TREND
            </h2>
          </div>

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

        {/* Legend */}
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
            <span>総合スコア (0-100)</span>
          </span>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-hidden rounded-xl bg-[#111214] border border-[#2C2F36] p-2">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto block">
            {/* Horizontal grid lines */}
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

            {/* Target Weight Reference Line */}
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

            {/* Score dashed line */}
            <path
              d={scorePath}
              fill="none"
              stroke="#8E929B"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.7"
            />

            {/* Normalized Weight solid line */}
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

            {/* Raw Weight dots & Normalized Weight points */}
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

            {/* X-axis date labels */}
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

        {/* Reset Demo Data helper */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#8E929B]">
            目標体重: {profile.targetWeight.toFixed(1)}kg / 開始基準: {profile.baselineWeight.toFixed(1)}kg
          </span>
          <button
            type="button"
            onClick={onResetDemo}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8E929B] hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>デモデータ初期化</span>
          </button>
        </div>
      </div>
    </div>
  );
};
