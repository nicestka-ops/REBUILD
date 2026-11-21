import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import {
  Activity,
  Bell,
  Dumbbell,
  Home,
  LineChart,
  ListChecks,
  Menu,
  Scale,
  UserCheck,
  UserCircle2,
} from 'lucide-react';
import {
  AppState,
  ConditionLevel,
  ENABLE_NUTRITION,
  RunningRouteType,
  ShiftHours,
  TabId,
  UserProfile,
  WeightTiming,
  WorkoutExerciseId,
} from './types/rebuild';
import { getJstNowFormatted, getJstRebuildDateKey } from './utils/dateJst';
import {
  calculateScoreBreakdown,
  calculateStreakDays,
  computeNormalizedWeight,
  getLatestNormalizedWeight,
  getStageFromScore,
} from './utils/recoveryEngine';
import {
  clearAllAppData,
  createEmptyDailyRecord,
  loadAppState,
  resetToDemoState,
  saveAppState,
} from './utils/storage';
import {
  createSupabaseClientFromConfig,
  extractCloudStateFromUser,
  getEffectiveSupabaseConfig,
  isEmailAllowed,
  pushCloudState,
  saveStoredSupabaseConfig,
  StoredSupabaseConfig,
} from './lib/supabase';
import {
  getJstHHMM,
  isNotificationSupported,
  loadNotificationSettings,
  NotificationSettings,
  registerRebuildServiceWorker,
  requestAppNotificationPermission,
  saveNotificationSettings,
  sendAppNotification,
} from './lib/notifications';
import { RunnerCanvas } from './components/RunnerCanvas';
import { DashboardTab } from './components/DashboardTab';
import { WorkoutTab } from './components/WorkoutTab';
import { WeightLogTab } from './components/WeightLogTab';
import { TrendTab } from './components/TrendTab';
import { DailyTab } from './components/DailyTab';
import { QuickWeightModal } from './components/QuickWeightModal';
import { AccountModal } from './components/AccountModal';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [todayKey, setTodayKey] = useState<string>(() => getJstRebuildDateKey());
  const [jstClock, setJstClock] = useState<string>(() => getJstNowFormatted());
  const [debugScore, setDebugScore] = useState<number | null>(null);
  const [devTestMode, setDevTestMode] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Account & Notification modal state
  const [accountModalTab, setAccountModalTab] = useState<'account' | 'notifications' | null>(null);
  const [supabaseConfig, setSupabaseConfig] = useState<StoredSupabaseConfig | null>(() =>
    getEffectiveSupabaseConfig()
  );
  const supabaseClient = useMemo(
    () => createSupabaseClientFromConfig(supabaseConfig),
    [supabaseConfig]
  );
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const skipNextCloudPushRef = useRef(false);

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() =>
    loadNotificationSettings()
  );
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    isNotificationSupported() ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  useEffect(() => {
    registerRebuildServiceWorker();
  }, []);

  // Automatically disable unauthenticated test UI & preview score the moment user logs in
  useEffect(() => {
    if (user) {
      setDebugScore(null);
      setDevTestMode(false);
    }
  }, [user]);

  useEffect(() => {
    if (!supabaseClient) {
      setUser(null);
      return;
    }

    let mounted = true;
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setAuthError(error.message);
        return;
      }
      const sessionUser = data.session?.user ?? null;
      if (sessionUser && !isEmailAllowed(sessionUser.email)) {
        setAuthError('このGoogleアカウントは許可リストに含まれていません。');
        supabaseClient.auth.signOut();
        setUser(null);
        return;
      }
      setUser(sessionUser);
      const cloudState = extractCloudStateFromUser(sessionUser);
      if (cloudState) {
        skipNextCloudPushRef.current = true;
        setAppState(cloudState);
        setSyncStatus('synced');
      }
    });

    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      if (nextUser && !isEmailAllowed(nextUser.email)) {
        setAuthError('このGoogleアカウントは許可リストに含まれていません。');
        supabaseClient.auth.signOut();
        setUser(null);
        return;
      }
      setAuthError(null);
      setUser(nextUser);
      const cloudState = extractCloudStateFromUser(nextUser);
      if (cloudState) {
        skipNextCloudPushRef.current = true;
        setAppState(cloudState);
        setSyncStatus('synced');
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabaseClient]);

  useEffect(() => {
    if (!supabaseClient || !user) return;
    if (skipNextCloudPushRef.current) {
      skipNextCloudPushRef.current = false;
      return;
    }
    setSyncStatus('syncing');
    const id = window.setTimeout(async () => {
      const ok = await pushCloudState(supabaseClient, appState);
      setSyncStatus(ok ? 'synced' : 'error');
    }, 900);
    return () => window.clearTimeout(id);
  }, [appState, supabaseClient, user]);

  useEffect(() => {
    const checkRolloverAndNotify = () => {
      const nextKey = getJstRebuildDateKey();
      setTodayKey((prev) => (prev !== nextKey ? nextKey : prev));
      setJstClock(getJstNowFormatted());

      if (
        notifSettings.enabled &&
        isNotificationSupported() &&
        Notification.permission === 'granted' &&
        notifSettings.lastNotifiedDateKey !== nextKey
      ) {
        const rec = appState.records[nextKey];
        const isConditionMissing = !rec || rec.conditionLevel === null;
        const nowHHMM = getJstHHMM();
        if (isConditionMissing && nowHHMM >= notifSettings.reminderTime) {
          sendAppNotification(
            'REBUILD — 今日の体調チェック',
            'JST 05:00 リセット済みです。今日の体調と体重を記録してランナーを動かしましょう！'
          ).then((sent) => {
            if (sent) {
              const updated = { ...notifSettings, lastNotifiedDateKey: nextKey };
              setNotifSettings(updated);
              saveNotificationSettings(updated);
            }
          });
        }
      }
    };

    checkRolloverAndNotify();
    const id = window.setInterval(checkRolloverAndNotify, 30000);
    window.addEventListener('visibilitychange', checkRolloverAndNotify);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('visibilitychange', checkRolloverAndNotify);
    };
  }, [notifSettings, appState.records]);

  const todayRecord = useMemo(
    () =>
      appState.records[todayKey] ??
      createEmptyDailyRecord(todayKey, appState.profile.defaultShiftHours ?? 'none'),
    [appState.records, todayKey, appState.profile.defaultShiftHours]
  );

  const breakdown = useMemo(
    () => calculateScoreBreakdown(appState.records, appState.profile, todayKey),
    [appState.records, appState.profile, todayKey]
  );

  const displayScore = debugScore !== null ? debugScore : breakdown.totalScore;
  const stageInfo = useMemo(() => getStageFromScore(displayScore), [displayScore]);
  const streakDays = useMemo(
    () => calculateStreakDays(appState.records, todayKey),
    [appState.records, todayKey]
  );

  const latestWeightInfo = useMemo(
    () => getLatestNormalizedWeight(appState.records, todayKey),
    [appState.records, todayKey]
  );

  const updateTodayRecord = (updater: (prev: typeof todayRecord) => typeof todayRecord) => {
    setAppState((prev) => {
      const current =
        prev.records[todayKey] ??
        createEmptyDailyRecord(todayKey, prev.profile.defaultShiftHours ?? 'none');
      return {
        ...prev,
        records: {
          ...prev.records,
          [todayKey]: updater(current),
        },
      };
    });
  };

  const handleSelectCondition = (level: ConditionLevel) => {
    updateTodayRecord((rec) => ({
      ...rec,
      conditionLevel: level,
      conditionUpdatedAt: new Date().toISOString(),
    }));
  };

  const handleSelectShift = (shiftHours: ShiftHours) => {
    updateTodayRecord((rec) => ({
      ...rec,
      shiftHours,
    }));
  };

  const handleToggleTask = (taskId: string) => {
    updateTodayRecord((rec) => {
      const exists = rec.completedTasks.includes(taskId);
      return {
        ...rec,
        completedTasks: exists
          ? rec.completedTasks.filter((id) => id !== taskId)
          : [...rec.completedTasks, taskId],
      };
    });
  };

  const handleToggleWorkout = (workoutId: WorkoutExerciseId) => {
    updateTodayRecord((rec) => {
      const exists = rec.completedWorkouts.includes(workoutId);
      return {
        ...rec,
        completedWorkouts: exists
          ? rec.completedWorkouts.filter((id) => id !== workoutId)
          : [...rec.completedWorkouts, workoutId],
      };
    });
  };

  const handleSaveRunningDistance = (
    km: number,
    routeType?: RunningRouteType,
    toughPointsCleared?: number
  ) => {
    updateTodayRecord((rec) => {
      const nextWorkouts = [...rec.completedWorkouts];
      if (km > 0 && !nextWorkouts.includes('running_jog') && !nextWorkouts.includes('running_goal')) {
        nextWorkouts.push('running_jog');
      }
      return {
        ...rec,
        runningDistanceKm: km,
        runningRouteType: routeType ?? rec.runningRouteType ?? null,
        runningToughPointsCleared:
          toughPointsCleared !== undefined
            ? Math.max(rec.runningToughPointsCleared ?? 0, toughPointsCleared)
            : rec.runningToughPointsCleared ?? 0,
        completedWorkouts: nextWorkouts,
      };
    });
  };

  const handleSaveWeight = (rawWeight: number, timing: WeightTiming) => {
    const normalizedWeight = computeNormalizedWeight(rawWeight, timing);
    updateTodayRecord((rec) => ({
      ...rec,
      rawWeight,
      weightTiming: timing,
      normalizedWeight,
    }));
  };

  const handleUpdateProfile = (nextProfile: UserProfile) => {
    setAppState((prev) => ({
      ...prev,
      profile: nextProfile,
    }));
  };

  const handleResetDemo = () => {
    setDebugScore(null);
    setAppState(resetToDemoState());
  };

  const handleClearAllData = () => {
    setDebugScore(null);
    setDevTestMode(false);
    const empty = clearAllAppData();
    setAppState(empty);
    if (supabaseClient && user) {
      pushCloudState(supabaseClient, empty);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabaseClient) return;
    setAuthError(null);
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    setUser(null);
    setSyncStatus('idle');
  };

  const handleSyncNow = async () => {
    if (!supabaseClient || !user) return;
    setSyncStatus('syncing');
    const ok = await pushCloudState(supabaseClient, appState);
    setSyncStatus(ok ? 'synced' : 'error');
  };

  const navItems: { id: TabId; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'ホーム', icon: Home },
    { id: 'workout', label: 'ワークアウト', icon: Dumbbell },
    { id: 'weight', label: '体重・ログ', icon: Scale },
    { id: 'trend', label: '推移グラフ', icon: LineChart },
    { id: 'daily', label: 'デイリー', icon: ListChecks },
  ];

  return (
    <div className="min-h-screen bg-[#111214] text-white flex flex-col">
      {/* Top Minimal Header */}
      <header className="sticky top-0 z-30 bg-[#111214]/90 backdrop-blur-md border-b border-[#2C2F36] pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Hamburger (☰) Left Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg bg-[#1C1E22] border border-[#2C2F36] text-[#8E929B] hover:text-[#CCFF00] hover:border-[#CCFF00]/50 transition-colors cursor-pointer"
              title="設定・メニュー"
              aria-label="設定メニュー"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#CCFF00]" />
              <span className="font-black tracking-[0.22em] text-sm text-white">
                REBUILD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-athletic text-[#8E929B] mr-1">
              <span>JST {jstClock}</span>
              <span className="text-[#2C2F36]">|</span>
              <span>DAY {todayKey.slice(5)}</span>
            </div>

            {/* Notification Bell Button */}
            <button
              type="button"
              onClick={() => setAccountModalTab('notifications')}
              className={`relative p-1.5 rounded-lg border transition-colors cursor-pointer ${
                notifSettings.enabled && notifPermission === 'granted'
                  ? 'bg-[#CCFF00]/12 border-[#CCFF00]/40 text-[#CCFF00]'
                  : 'bg-[#1C1E22] border-[#2C2F36] text-[#8E929B] hover:text-white'
              }`}
              title="アプリ通知設定"
              aria-label="アプリ通知設定"
            >
              <Bell className="w-4 h-4" />
              {notifSettings.enabled && notifPermission === 'granted' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#CCFF00]" />
              )}
            </button>

            {/* Google Account Button */}
            <button
              type="button"
              onClick={() => setAccountModalTab('account')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                user
                  ? 'bg-[#CCFF00]/12 border-[#CCFF00]/40 text-[#CCFF00]'
                  : 'bg-[#1C1E22] border-[#2C2F36] text-[#8E929B] hover:text-white'
              }`}
              title="Googleログイン・同期"
            >
              {user ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="max-w-[80px] truncate hidden xs:inline">
                    {(user.user_metadata?.full_name as string)?.split(' ')[0] || 'SYNC'}
                  </span>
                </>
              ) : (
                <>
                  <UserCircle2 className="w-3.5 h-3.5" />
                  <span>ログイン</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <div key={activeTab} className="animate-tab-enter">
        {activeTab === 'home' && (
          <>
            <RunnerCanvas
              score={displayScore}
              stageInfo={stageInfo}
              streakDays={streakDays}
              debugScore={debugScore}
              isLoggedIn={Boolean(user)}
              showTestControls={!user || devTestMode}
              onDebugScoreChange={setDebugScore}
            />

            <div className="max-w-3xl mx-auto px-4 pt-4">
              <DashboardTab
                todayRecord={todayRecord}
                latestWeight={latestWeightInfo?.weight ?? null}
                profile={appState.profile}
                breakdown={breakdown}
                score={displayScore}
                onSelectCondition={handleSelectCondition}
                onSelectShift={handleSelectShift}
                onToggleTask={handleToggleTask}
                onOpenWeightModal={() => setIsWeightModalOpen(true)}
                onGoToWorkout={() => setActiveTab('workout')}
              />
            </div>
          </>
        )}

        {activeTab === 'workout' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <WorkoutTab
              conditionLevel={todayRecord.conditionLevel}
              shiftHours={todayRecord.shiftHours}
              score={displayScore}
              completedWorkouts={todayRecord.completedWorkouts}
              runningDistanceKm={todayRecord.runningDistanceKm}
              runningRouteType={todayRecord.runningRouteType}
              onToggleWorkout={handleToggleWorkout}
              onSaveRunningDistance={handleSaveRunningDistance}
              onSelectShift={handleSelectShift}
            />
          </div>
        )}

        {activeTab === 'weight' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <WeightLogTab
              todayRecord={todayRecord}
              profile={appState.profile}
              latestWeight={latestWeightInfo?.weight ?? null}
              onSelectShift={handleSelectShift}
              onSaveWeight={handleSaveWeight}
            />
          </div>
        )}

        {activeTab === 'trend' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <TrendTab
              todayKey={todayKey}
              records={appState.records}
              profile={appState.profile}
            />
          </div>
        )}

        {activeTab === 'daily' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <DailyTab
              todayRecord={todayRecord}
              streakDays={streakDays}
              breakdown={breakdown}
              stageInfo={stageInfo}
              onToggleTask={handleToggleTask}
            />
          </div>
        )}
        </div>

        {/* Reserved Nutrition Feature Slot (hidden while ENABLE_NUTRITION === false) */}
        {ENABLE_NUTRITION && (
          <div className="hidden" data-reserved="nutrition" />
        )}
      </main>

      {/* 5-Item Bottom Navigation (with iOS/iPadOS safe-area support) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#111214]/95 backdrop-blur-md border-t border-[#2C2F36] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-[#CCFF00]' : 'text-[#8E929B] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-bold tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Quick Weight Modal */}
      {isWeightModalOpen && (
        <QuickWeightModal
          initialWeight={
            todayRecord.rawWeight ??
            latestWeightInfo?.weight ??
            appState.profile.baselineWeight
          }
          initialTiming={todayRecord.weightTiming ?? 'fasted'}
          onSave={handleSaveWeight}
          onClose={() => setIsWeightModalOpen(false)}
        />
      )}

      {/* Left Slide-in Settings Drawer (opened from top-left ☰ button) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        profile={appState.profile}
        realScore={breakdown.totalScore}
        debugScore={debugScore}
        devTestMode={devTestMode}
        onToggleDevTestMode={(enabled) => {
          setDevTestMode(enabled);
          if (!enabled) setDebugScore(null);
        }}
        onUpdateProfile={handleUpdateProfile}
        onDebugScoreChange={setDebugScore}
        onResetDemo={handleResetDemo}
        onClearAllData={handleClearAllData}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Account & Notification Modal */}
      {accountModalTab && (
        <AccountModal
          initialTab={accountModalTab}
          user={user}
          supabaseConfig={supabaseConfig}
          syncStatus={syncStatus}
          authError={authError}
          notifSettings={notifSettings}
          notifPermission={notifPermission}
          onClose={() => setAccountModalTab(null)}
          onGoogleLogin={handleGoogleLogin}
          onLogout={handleLogout}
          onSyncNow={handleSyncNow}
          onSaveSupabaseConfig={(url, key) => {
            const saved = saveStoredSupabaseConfig(url, key);
            setSupabaseConfig(saved);
          }}
          onUpdateNotifSettings={(next) => {
            setNotifSettings(next);
            saveNotificationSettings(next);
          }}
          onRequestNotifPermission={async () => {
            const perm = await requestAppNotificationPermission();
            setNotifPermission(perm);
            if (perm === 'granted') {
              const next = { ...notifSettings, enabled: true };
              setNotifSettings(next);
              saveNotificationSettings(next);
            }
          }}
          onSendTestNotification={() =>
            sendAppNotification(
              'REBUILD — 通知テスト',
              '通知設定が完了しました！JST 05:00リセット後の体調チェックをお知らせします。'
            )
          }
        />
      )}
    </div>
  );
}

export default App;
