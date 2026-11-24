import React, { useState } from 'react';
import { Calendar, Scale, X } from 'lucide-react';
import { DailyRecord, WeightTiming } from '../types/rebuild';
import { shiftDateKey } from '../utils/dateJst';
import { computeNormalizedWeight, WEIGHT_TIMING_OPTIONS } from '../utils/recoveryEngine';

interface QuickWeightModalProps {
  todayKey: string;
  records: Record<string, DailyRecord>;
  initialWeight: number;
  initialTiming: WeightTiming;
  onSave: (rawWeight: number, timing: WeightTiming, targetDateKey: string) => void;
  onClose: () => void;
}

export const QuickWeightModal: React.FC<QuickWeightModalProps> = ({
  todayKey,
  records,
  initialWeight,
  initialTiming,
  onSave,
  onClose,
}) => {
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [rawWeight, setRawWeight] = useState<string>(initialWeight.toFixed(1));
  const [timing, setTiming] = useState<WeightTiming>(initialTiming);

  const yesterdayKey = shiftDateKey(todayKey, -1);
  const twoDaysAgoKey = shiftDateKey(todayKey, -2);

  const handleSelectDate = (nextKey: string) => {
    if (!nextKey || nextKey > todayKey) return;
    setSelectedDateKey(nextKey);
    const existing = records[nextKey];
    if (existing?.rawWeight !== null && existing?.rawWeight !== undefined) {
      setRawWeight(existing.rawWeight.toFixed(1));
      setTiming(existing.weightTiming ?? 'fasted');
    } else {
      setRawWeight(initialWeight.toFixed(1));
      setTiming('fasted');
    }
  };

  const existingOnSelected = records[selectedDateKey];
  const isPastDate = selectedDateKey < todayKey;
  const parsed = parseFloat(rawWeight);
  const isValid = !Number.isNaN(parsed) && parsed >= 30 && parsed <= 180;
  const normalized = isValid ? computeNormalizedWeight(parsed, timing) : null;

  const stepWeight = (delta: number) => {
    const base = isValid ? parsed : initialWeight;
    const next = Math.max(30, Math.min(180, Math.round((base + delta) * 10) / 10));
    setRawWeight(next.toFixed(1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#1C1E22] border border-[#2C2F36] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#CCFF00]" />
            <h3 className="text-base font-bold text-white">
              {isPastDate ? '過去の体重をさかのぼり登録' : '今日の体重を記録'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8E929B] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Selector (Backfill Support) */}
        <div className="rounded-xl bg-[#111214] border border-[#2C2F36] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8E929B]">
              <Calendar className="w-3.5 h-3.5 text-[#CCFF00]" />
              記録日を選択
            </span>
            <span className="text-[10px] font-mono-athletic font-bold text-[#CCFF00]">
              {existingOnSelected?.rawWeight != null
                ? `記録済み: ${existingOnSelected.rawWeight.toFixed(1)}kg（上書き）`
                : isPastDate
                ? '未記録（さかのぼり）'
                : '本日の記録'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: '今日', key: todayKey },
              { label: '昨日', key: yesterdayKey },
              { label: '一昨日', key: twoDaysAgoKey },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectDate(item.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  selectedDateKey === item.key
                    ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                    : 'bg-[#1C1E22] border-[#2C2F36] text-[#8E929B] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
            <input
              type="date"
              max={todayKey}
              value={selectedDateKey}
              onChange={(e) => handleSelectDate(e.target.value)}
              aria-label="記録日"
              className="flex-1 min-w-[130px] px-2.5 py-1 rounded-lg bg-[#1C1E22] border border-[#2C2F36] font-mono-athletic text-xs font-bold text-white focus:outline-none focus:border-[#CCFF00]"
            />
          </div>
        </div>

        {/* Stepper + Input */}
        <div className="flex items-center justify-between gap-3 bg-[#111214] border border-[#2C2F36] rounded-xl p-3">
          <button
            type="button"
            onClick={() => stepWeight(-0.1)}
            className="w-11 h-11 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-white font-bold text-lg hover:border-[#CCFF00]/60 cursor-pointer"
          >
            -0.1
          </button>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              step="0.1"
              min="30"
              max="180"
              value={rawWeight}
              onChange={(e) => setRawWeight(e.target.value)}
              className="w-24 bg-transparent text-center font-mono-athletic text-3xl font-black text-white focus:outline-none"
            />
            <span className="text-sm font-semibold text-[#8E929B]">kg</span>
          </div>
          <button
            type="button"
            onClick={() => stepWeight(0.1)}
            className="w-11 h-11 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-white font-bold text-lg hover:border-[#CCFF00]/60 cursor-pointer"
          >
            +0.1
          </button>
        </div>

        {/* 3 Timing Tags */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#8E929B]">計測タイミング（食前・食後ブレ補正）</p>
          <div className="grid grid-cols-1 gap-2">
            {WEIGHT_TIMING_OPTIONS.map((opt) => {
              const selected = timing === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTiming(opt.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selected
                      ? 'bg-[#CCFF00]/12 border-[#CCFF00] text-white'
                      : 'bg-[#111214] border-[#2C2F36] text-[#8E929B] hover:border-[#3E424B]'
                  }`}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span
                    className={`font-mono-athletic text-xs font-bold px-2 py-0.5 rounded ${
                      selected ? 'bg-[#CCFF00] text-black' : 'bg-[#2C2F36] text-[#8E929B]'
                    }`}
                  >
                    補正 {opt.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Normalized Preview */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#111214] border border-[#2C2F36]">
          <span className="text-xs font-semibold text-[#8E929B]">補正後ベース体重</span>
          <span className="font-mono-athletic text-lg font-extrabold text-[#CCFF00]">
            {normalized !== null ? `${normalized.toFixed(1)} kg` : '--.- kg'}
          </span>
        </div>

        <button
          type="button"
          disabled={!isValid}
          onClick={() => {
            if (isValid) {
              onSave(Math.round(parsed * 10) / 10, timing, selectedDateKey);
              onClose();
            }
          }}
          className="w-full py-3 rounded-xl bg-[#CCFF00] text-black font-extrabold text-sm tracking-wide hover:brightness-105 disabled:opacity-40 transition-all cursor-pointer"
        >
          {selectedDateKey} の体重を保存して更新
        </button>
      </div>
    </div>
  );
};
