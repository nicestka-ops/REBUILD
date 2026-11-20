import React, { useState } from 'react';
import { Briefcase, RotateCcw, Scale, SlidersHorizontal, X } from 'lucide-react';
import { ENABLE_NUTRITION, ShiftHours, UserProfile } from '../types/rebuild';
import { SHIFT_OPTIONS } from '../utils/recoveryEngine';

interface SettingsModalProps {
  profile: UserProfile;
  realScore: number;
  debugScore: number | null;
  onUpdateProfile: (next: UserProfile) => void;
  onDebugScoreChange: (val: number | null) => void;
  onResetDemo: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  profile,
  realScore,
  debugScore,
  onUpdateProfile,
  onDebugScoreChange,
  onResetDemo,
  onClose,
}) => {
  const [baseline, setBaseline] = useState(profile.baselineWeight.toFixed(1));
  const [target, setTarget] = useState(profile.targetWeight.toFixed(1));
  const [defaultShift, setDefaultShift] = useState<ShiftHours>(
    profile.defaultShiftHours ?? 'none'
  );

  const parsedBase = parseFloat(baseline);
  const parsedTarget = parseFloat(target);
  const isValid =
    !Number.isNaN(parsedBase) &&
    !Number.isNaN(parsedTarget) &&
    parsedBase >= 30 &&
    parsedTarget >= 30;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#1C1E22] border border-[#2C2F36] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white tracking-wide">
            設定 &amp; デバッグ
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E929B] hover:text-white cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target & Baseline Weight */}
        <div className="p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36] space-y-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-white">
            <Scale className="w-4 h-4 text-[#CCFF00]" />
            <span>目標体重・初期体重</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] text-[#8E929B] mb-1">
                初期体重 (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1C1E22] border border-[#2C2F36] font-mono-athletic text-sm font-bold text-white focus:outline-none focus:border-[#CCFF00]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#8E929B] mb-1">
                目標体重 (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1C1E22] border border-[#2C2F36] font-mono-athletic text-sm font-bold text-white focus:outline-none focus:border-[#CCFF00]"
              />
            </div>
          </div>
        </div>

        {/* Default Shift Hours */}
        <div className="p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36] space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-white">
            <Briefcase className="w-4 h-4 text-[#CCFF00]" />
            <span>バイトシフトのデフォルト設定</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {SHIFT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDefaultShift(opt.id)}
                className={`py-2 rounded-lg border text-xs font-bold cursor-pointer ${
                  defaultShift === opt.id
                    ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                    : 'bg-[#1C1E22] border-[#2C2F36] text-[#8E929B] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!isValid}
          onClick={() => {
            if (!isValid) return;
            onUpdateProfile({
              baselineWeight: Math.round(parsedBase * 10) / 10,
              targetWeight: Math.round(parsedTarget * 10) / 10,
              defaultShiftHours: defaultShift,
            });
            onClose();
          }}
          className="w-full py-2.5 rounded-xl bg-[#CCFF00] text-black font-extrabold text-xs tracking-wide hover:brightness-105 disabled:opacity-40 cursor-pointer"
        >
          プロフィール設定を保存
        </button>

        {/* Debug Score Slider */}
        <div className="p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-white">
              <SlidersHorizontal className="w-4 h-4 text-[#CCFF00]" />
              <span>デバッグ用スコア操作 (0〜100)</span>
            </div>
            <span className="font-mono-athletic text-xs font-bold text-[#CCFF00]">
              {debugScore ?? realScore} pt
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={debugScore ?? realScore}
            onChange={(e) => onDebugScoreChange(Number(e.target.value))}
            className="volt-slider w-full"
          />
          <div className="flex items-center justify-between text-[11px] text-[#8E929B]">
            <span>現在: {debugScore !== null ? 'テスト値プレビュー中' : '実累積スコア'}</span>
            {debugScore !== null && (
              <button
                type="button"
                onClick={() => onDebugScoreChange(null)}
                className="px-2 py-0.5 rounded bg-[#2C2F36] text-white font-bold cursor-pointer"
              >
                実値に戻す
              </button>
            )}
          </div>
        </div>

        {/* Future Nutrition Flag Status & Demo Reset */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-[#8E929B]">
          <span>
            食事拡張フラグ: <code className="text-white">ENABLE_NUTRITION = {String(ENABLE_NUTRITION)}</code>
          </span>
          <button
            type="button"
            onClick={() => {
              onResetDemo();
              onClose();
            }}
            className="inline-flex items-center gap-1 text-[#8E929B] hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>デモデータ初期化</span>
          </button>
        </div>
      </div>
    </div>
  );
};
