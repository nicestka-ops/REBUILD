import React, { useState } from 'react';
import { Briefcase, X } from 'lucide-react';
import { ShiftHours } from '../types/rebuild';
import { SHIFT_OPTIONS } from '../utils/recoveryEngine';

interface QuickShiftModalProps {
  initialShift: ShiftHours;
  onSave: (shift: ShiftHours) => void;
  onClose: () => void;
}

export const QuickShiftModal: React.FC<QuickShiftModalProps> = ({
  initialShift,
  onSave,
  onClose,
}) => {
  const [selected, setSelected] = useState<ShiftHours>(initialShift);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#1C1E22] border border-[#2C2F36] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl animate-tab-enter">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#CCFF00]" />
            <h3 className="text-base font-extrabold text-white tracking-wide">
              今日のバイト時間を設定
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E929B] hover:text-white cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#8E929B]">
          シフト時間に応じて、今日の推奨ランニング距離とトレーニング負荷が自動調整されます。
        </p>

        <div className="grid grid-cols-2 gap-2">
          {SHIFT_OPTIONS.map((opt) => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                className={`py-3 px-3 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                    : 'bg-[#111214] border-[#2C2F36] text-white hover:border-[#CCFF00]/50'
                }`}
              >
                <div className="text-sm font-extrabold">{opt.label}</div>
                <div className={`text-[11px] mt-0.5 ${active ? 'text-black/75' : 'text-[#8E929B]'}`}>
                  {opt.id === 'none'
                    ? '5.0km〜 しっかりラン'
                    : opt.id === 'short'
                    ? '1.5〜3.5km 短時間ラン'
                    : opt.id === 'medium'
                    ? '0.5〜2.0km 軽めラン'
                    : '0.0km 疲労ケア優先'}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onSave(selected);
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-[#CCFF00] text-black font-extrabold text-xs tracking-wide hover:brightness-105 cursor-pointer"
        >
          バイト時間を保存してタスク完了
        </button>
      </div>
    </div>
  );
};
