import React, { useState } from 'react';
import { Briefcase, Check, Scale } from 'lucide-react';
import {
  DailyRecord,
  ShiftHours,
  UserProfile,
  WeightTiming,
} from '../types/rebuild';
import {
  computeNormalizedWeight,
  SHIFT_OPTIONS,
  WEIGHT_TIMING_OPTIONS,
} from '../utils/recoveryEngine';

interface WeightLogTabProps {
  todayRecord: DailyRecord;
  profile: UserProfile;
  latestWeight: number | null;
  onSelectShift: (shift: ShiftHours) => void;
  onSaveWeight: (rawWeight: number, timing: WeightTiming) => void;
}

export const WeightLogTab: React.FC<WeightLogTabProps> = ({
  todayRecord,
  profile,
  latestWeight,
  onSelectShift,
  onSaveWeight,
}) => {
  const initialWeight =
    todayRecord.rawWeight ?? latestWeight ?? profile.baselineWeight;
  const [rawInput, setRawInput] = useState<string>(initialWeight.toFixed(1));
  const [timing, setTiming] = useState<WeightTiming>(
    todayRecord.weightTiming ?? 'fasted'
  );
  const [savedFlash, setSavedFlash] = useState(false);

  const parsed = parseFloat(rawInput);
  const isValid = !Number.isNaN(parsed) && parsed >= 30 && parsed <= 180;
  const previewNormalized = isValid
    ? computeNormalizedWeight(parsed, timing)
    : null;

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

  return (
    <div className="space-y-4">
      {/* Weight Input Form with 3 Timing Tags */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold text-white tracking-wide">
              体重記録（0.1kg単位・食前/食後補正）
            </h2>
          </div>
          {todayRecord.normalizedWeight !== null && (
            <span className="text-[11px] font-mono-athletic font-bold text-[#CCFF00]">
              本日保存済: {todayRecord.normalizedWeight.toFixed(1)}kg
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 bg-[#111214] border border-[#2C2F36] rounded-xl p-3">
          <button
            type="button"
            onClick={() => stepWeight(-0.1)}
            className="w-12 h-11 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-white font-bold text-sm hover:border-[#CCFF00]/60 cursor-pointer"
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
              className="w-24 bg-transparent text-center font-mono-athletic text-3xl font-black text-white focus:outline-none"
            />
            <span className="text-xs font-semibold text-[#8E929B]">kg（実測）</span>
          </div>
          <button
            type="button"
            onClick={() => stepWeight(0.1)}
            className="w-12 h-11 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-white font-bold text-sm hover:border-[#CCFF00]/60 cursor-pointer"
          >
            +0.1
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {WEIGHT_TIMING_OPTIONS.map((opt) => {
            const active = timing === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTiming(opt.id)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
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
            補正後ベース体重:{' '}
            <span className="font-mono-athletic text-base font-extrabold text-[#CCFF00]">
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

      {/* Shift Hours Selector */}
      <div className="rounded-2xl bg-[#1C1E22] border border-[#2C2F36] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#CCFF00]" />
            <h2 className="text-sm font-extrabold text-white tracking-wide">
              今日のアルバイト時間
            </h2>
          </div>
          <span className="text-[11px] text-[#8E929B]">タスク＆メニュー提案に連動</span>
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
                <div
                  className={`text-[10px] mt-0.5 ${
                    active ? 'text-black/75 font-bold' : 'text-[#8E929B]'
                  }`}
                >
                  {opt.loadLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
