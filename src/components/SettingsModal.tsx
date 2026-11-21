import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Briefcase, RotateCcw, Scale, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { ENABLE_NUTRITION, ShiftHours, UserProfile } from '../types/rebuild';
import { SHIFT_OPTIONS } from '../utils/recoveryEngine';

interface SettingsModalProps {
  isOpen: boolean;
  profile: UserProfile;
  realScore: number;
  debugScore: number | null;
  devTestMode: boolean;
  onToggleDevTestMode: (enabled: boolean) => void;
  onUpdateProfile: (next: UserProfile) => void;
  onDebugScoreChange: (val: number | null) => void;
  onResetDemo: () => void;
  onClearAllData: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  profile,
  realScore,
  debugScore,
  devTestMode,
  onToggleDevTestMode,
  onUpdateProfile,
  onDebugScoreChange,
  onResetDemo,
  onClearAllData,
  onClose,
}) => {
  const [baseline, setBaseline] = useState(profile.baselineWeight.toFixed(1));
  const [target, setTarget] = useState(profile.targetWeight.toFixed(1));
  const [defaultShift, setDefaultShift] = useState<ShiftHours>(
    profile.defaultShiftHours ?? 'none'
  );
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBaseline(profile.baselineWeight.toFixed(1));
      setTarget(profile.targetWeight.toFixed(1));
      setDefaultShift(profile.defaultShiftHours ?? 'none');
      setConfirmClearOpen(false);
    }
  }, [isOpen, profile]);

  const parsedBase = parseFloat(baseline);
  const parsedTarget = parseFloat(target);
  const isValid =
    !Number.isNaN(parsedBase) &&
    !Number.isNaN(parsedTarget) &&
    parsedBase >= 30 &&
    parsedTarget >= 30;

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop Overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Left Slide-in Drawer */}
      <aside
        onTouchStart={(e) => {
          touchStartXRef.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartXRef.current === null) return;
          const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
          if (endX - touchStartXRef.current < -50) {
            onClose();
          }
          touchStartXRef.current = null;
        }}
        className="relative h-full w-[86vw] max-w-sm bg-[#1C1E22] border-r border-[#2C2F36] shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        style={{
          transform: isOpen ? 'translate3d(0, 0, 0)' : 'translate3d(-100%, 0, 0)',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2F36]">
          <h3 className="text-base font-extrabold text-white tracking-wide">
            設定 &amp; メニュー
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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

          {/* Developer / Verification Test Mode Switch & Slider */}
          <div className="p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <SlidersHorizontal className="w-4 h-4 text-[#CCFF00]" />
                <span>テストモード（ステージ確認）</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={devTestMode}
                onClick={() => onToggleDevTestMode(!devTestMode)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-colors cursor-pointer ${
                  devTestMode
                    ? 'bg-[#CCFF00] text-black'
                    : 'bg-[#2C2F36] text-[#8E929B] hover:text-white'
                }`}
              >
                {devTestMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {devTestMode ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E929B]">デバッグ用スコア操作 (0〜100)</span>
                  <span className="font-mono-athletic font-bold text-[#CCFF00]">
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
              </>
            ) : (
              <p className="text-[11px] text-[#8E929B]">
                ONにすると、ログイン中でもランナー画面のステージ確認スライダーを使用できます。
              </p>
            )}
          </div>

          {/* Full Data Reset Section */}
          <div className="p-3.5 rounded-xl bg-[#FF3B30]/8 border border-[#FF3B30]/35 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#FF3B30]">
              <Trash2 className="w-4 h-4" />
              <span>データ初期化・リセット</span>
            </div>
            <p className="text-[11px] text-[#8E929B] leading-relaxed">
              体重データ、日次ログ、ワークアウト履歴、体調チェック、累積スコア・ストリークをすべて消去して初期状態（50点 / Stage 5）に戻します。
            </p>
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              className="w-full py-2.5 rounded-xl bg-[#FF3B30]/20 hover:bg-[#FF3B30]/30 border border-[#FF3B30]/50 text-[#FF3B30] font-extrabold text-xs tracking-wide transition-colors cursor-pointer"
            >
              全データ削除（リセット）
            </button>
          </div>

          {/* Future Nutrition Flag Status & Demo Seed */}
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
              <span>デモデータ投入</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Confirmation Dialog for Full Data Reset */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#1C1E22] border border-[#FF3B30]/50 p-5 space-y-4 shadow-2xl animate-tab-enter">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#FF3B30]/15 text-[#FF3B30] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  全データ削除の確認
                </h4>
                <p className="text-xs text-[#D1D5DB] leading-relaxed">
                  体重データやこれまでの記録がすべて削除されます。元に戻せません。
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#2C2F36] text-white font-bold text-xs hover:bg-[#3A3E47] cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClearOpen(false);
                  onClearAllData();
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#FF3B30] text-white font-extrabold text-xs hover:brightness-110 cursor-pointer"
              >
                削除を実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
