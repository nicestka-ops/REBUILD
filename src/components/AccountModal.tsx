import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Cloud,
  KeyRound,
  LogOut,
  Send,
  Smartphone,
  X,
} from 'lucide-react';
import {
  isNotificationSupported,
  isStandalonePwa,
  NotificationSettings,
} from '../lib/notifications';
import {
  clearStoredSupabaseConfig,
  hasEnvSupabaseConfig,
  StoredSupabaseConfig,
} from '../lib/supabase';

interface AccountModalProps {
  initialTab: 'account' | 'notifications';
  user: User | null;
  supabaseConfig: StoredSupabaseConfig | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  authError: string | null;
  notifSettings: NotificationSettings;
  notifPermission: NotificationPermission | 'unsupported';
  onClose: () => void;
  onGoogleLogin: () => void;
  onLogout: () => void;
  onSyncNow: () => void;
  onSaveSupabaseConfig: (url: string, anonKey: string) => void;
  onUpdateNotifSettings: (next: NotificationSettings) => void;
  onRequestNotifPermission: () => void;
  onSendTestNotification: () => Promise<boolean>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  initialTab,
  user,
  supabaseConfig,
  syncStatus,
  authError,
  notifSettings,
  notifPermission,
  onClose,
  onGoogleLogin,
  onLogout,
  onSyncNow,
  onSaveSupabaseConfig,
  onUpdateNotifSettings,
  onRequestNotifPermission,
  onSendTestNotification,
}) => {
  const [tab, setTab] = useState<'account' | 'notifications'>(initialTab);
  const [urlInput, setUrlInput] = useState(supabaseConfig?.url ?? '');
  const [keyInput, setKeyInput] = useState(supabaseConfig?.anonKey ?? '');
  const [showManualConfig, setShowManualConfig] = useState(!supabaseConfig);
  const [testResult, setTestResult] = useState<string | null>(null);

  const standalone = isStandalonePwa();
  const notifSupported = isNotificationSupported();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#1C1E22] border border-[#2C2F36] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-[#111214] p-1 rounded-xl border border-[#2C2F36]">
            <button
              type="button"
              onClick={() => setTab('account')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                tab === 'account'
                  ? 'bg-[#CCFF00] text-black'
                  : 'text-[#8E929B] hover:text-white'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Googleログイン</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('notifications')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                tab === 'notifications'
                  ? 'bg-[#CCFF00] text-black'
                  : 'text-[#8E929B] hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>アプリ通知</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E929B] hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 1: Google Login & Cloud Sync */}
        {tab === 'account' && (
          <div className="space-y-4">
            {authError && (
              <div className="p-3 rounded-xl bg-[#FF3B30]/15 border border-[#FF3B30]/50 text-xs text-[#FF3B30] font-semibold">
                {authError}
              </div>
            )}

            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36]">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url as string}
                      alt="avatar"
                      className="w-11 h-11 rounded-full border border-[#CCFF00]/60"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#CCFF00]/15 border border-[#CCFF00]/50 flex items-center justify-center text-[#CCFF00] font-black">
                      {(user.email?.[0] ?? 'U').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-white truncate">
                      {(user.user_metadata?.full_name as string) || 'Googleアカウント連携中'}
                    </p>
                    <p className="text-xs text-[#8E929B] truncate">{user.email}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-[#CCFF00] shrink-0" />
                </div>

                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#111214] border border-[#2C2F36] text-xs">
                  <span className="text-[#8E929B] font-semibold">クラウド同期ステータス</span>
                  <span className="font-mono-athletic font-bold text-[#CCFF00]">
                    {syncStatus === 'syncing'
                      ? '同期中...'
                      : syncStatus === 'synced'
                      ? '同期済み ✓'
                      : syncStatus === 'error'
                      ? '同期エラー'
                      : '待機中'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onSyncNow}
                    className="py-2.5 px-3 rounded-xl bg-[#CCFF00] text-black font-extrabold text-xs hover:brightness-105 cursor-pointer"
                  >
                    今すぐクラウド同期
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#111214] border border-[#2C2F36] text-white font-bold text-xs hover:border-[#FF3B30]/60 hover:text-[#FF3B30] cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ログアウト</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36] space-y-1.5">
                  <p className="text-sm font-extrabold text-white">
                    Googleログインでマルチデバイス同期
                  </p>
                  <p className="text-xs text-[#8E929B] leading-relaxed">
                    PC・スマホ・iPad間で体調チェック・体重・ワークアウト履歴を自動同期します。
                  </p>
                </div>

                {supabaseConfig ? (
                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white text-black font-extrabold text-sm hover:bg-white/90 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    <span>Googleでログイン</span>
                  </button>
                ) : (
                  <p className="text-xs text-[#FF3B30] font-semibold">
                    ※ 下の Supabase URL / Anon Key を設定すると Googleログインが有効になります
                  </p>
                )}

                {!hasEnvSupabaseConfig && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowManualConfig((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8E929B] hover:text-white cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{showManualConfig ? 'Supabase接続設定を隠す' : 'Supabase接続設定を開く'}</span>
                    </button>

                    {showManualConfig && (
                      <div className="mt-2.5 p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36] space-y-2.5">
                        <p className="text-[11px] text-[#8E929B]">
                          家計簿アプリ等でお使いの Supabase Project URL と Anon Key を入力できます（端末内に保存）。
                        </p>
                        <input
                          type="url"
                          placeholder="https://xxxxx.supabase.co"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-xs text-white focus:outline-none focus:border-[#CCFF00]"
                        />
                        <input
                          type="text"
                          placeholder="eyJhbGciOi..."
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-xs text-white focus:outline-none focus:border-[#CCFF00]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!urlInput.trim() || !keyInput.trim()}
                            onClick={() => {
                              onSaveSupabaseConfig(urlInput, keyInput);
                              setShowManualConfig(false);
                            }}
                            className="flex-1 py-2 rounded-lg bg-[#CCFF00] text-black font-extrabold text-xs disabled:opacity-40 cursor-pointer"
                          >
                            接続設定を保存
                          </button>
                          {supabaseConfig && (
                            <button
                              type="button"
                              onClick={() => {
                                clearStoredSupabaseConfig();
                                setUrlInput('');
                                setKeyInput('');
                              }}
                              className="px-3 py-2 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-xs text-[#8E929B] hover:text-white cursor-pointer"
                            >
                              クリア
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: App Notifications (PWA / Web Push) */}
        {tab === 'notifications' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36]">
              <div className="flex items-center gap-2.5">
                <BellRing className="w-5 h-5 text-[#CCFF00]" />
                <div>
                  <p className="text-sm font-extrabold text-white">アプリ通知ステータス</p>
                  <p className="text-[11px] text-[#8E929B]">
                    {notifPermission === 'granted'
                      ? '許可済み（通知を受け取れます）'
                      : notifPermission === 'denied'
                      ? 'ブラウザ設定でブロックされています'
                      : notifPermission === 'unsupported'
                      ? 'ホーム画面に追加すると利用可能になります'
                      : '未許可（下のボタンで許可してください）'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                  notifPermission === 'granted'
                    ? 'bg-[#CCFF00]/15 text-[#CCFF00]'
                    : 'bg-[#FF3B30]/15 text-[#FF3B30]'
                }`}
              >
                {notifPermission === 'granted' ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Daily JST Reminder Toggle & Time */}
            <div className="p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">毎日リマインダー通知</p>
                  <p className="text-[11px] text-[#8E929B]">
                    JST 05:00リセット後に未回答のとき通知します
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateNotifSettings({
                      ...notifSettings,
                      enabled: !notifSettings.enabled,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                    notifSettings.enabled ? 'bg-[#CCFF00]' : 'bg-[#2C2F36]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-black transition-transform ${
                      notifSettings.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#2C2F36]">
                <span className="text-xs font-semibold text-[#8E929B]">通知時刻（日本時間）</span>
                <input
                  type="time"
                  value={notifSettings.reminderTime}
                  onChange={(e) =>
                    onUpdateNotifSettings({
                      ...notifSettings,
                      reminderTime: e.target.value || '08:00',
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-[#1C1E22] border border-[#2C2F36] font-mono-athletic text-xs font-bold text-white focus:outline-none focus:border-[#CCFF00]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!notifSupported}
                onClick={onRequestNotifPermission}
                className="py-2.5 px-3 rounded-xl bg-[#CCFF00] text-black font-extrabold text-xs hover:brightness-105 disabled:opacity-40 cursor-pointer"
              >
                通知を許可する
              </button>
              <button
                type="button"
                disabled={notifPermission !== 'granted'}
                onClick={async () => {
                  const ok = await onSendTestNotification();
                  setTestResult(ok ? 'テスト通知を送信しました ✓' : '送信できませんでした');
                  window.setTimeout(() => setTestResult(null), 2500);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#111214] border border-[#2C2F36] text-white font-bold text-xs hover:border-[#CCFF00] disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>テスト通知</span>
              </button>
            </div>

            {testResult && (
              <p className="text-center text-xs font-bold text-[#CCFF00]">{testResult}</p>
            )}

            {/* Smartphone & iPad PWA Install Guide */}
            <div className="p-3.5 rounded-xl bg-[#111214] border border-[#2C2F36] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                <Smartphone className="w-4 h-4 text-[#CCFF00]" />
                <span>
                  スマホ・iPadでのインストール＆通知方法
                  {standalone ? '（アプリモード起動中 ✓）' : ''}
                </span>
              </div>
              <p className="text-[11px] text-[#8E929B] leading-relaxed">
                iPhone / iPad の Safari で開き、画面下（または右上）の
                <strong className="text-white">「共有（□↑）」→「ホーム画面に追加」</strong>
                から起動すると、ネイティブアプリのように全画面表示され、iOSのアプリ通知が有効になります。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
