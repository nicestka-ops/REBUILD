export interface NotificationSettings {
  enabled: boolean;
  reminderTime: string; // HH:mm in JST, e.g. "08:00"
  lastNotifiedDateKey: string | null;
}

const NOTIF_SETTINGS_KEY = 'rebuild_notification_settings_v1';

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(NOTIF_SETTINGS_KEY);
    if (!raw) {
      return { enabled: false, reminderTime: '08:00', lastNotifiedDateKey: null };
    }
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      reminderTime: parsed.reminderTime || '08:00',
      lastNotifiedDateKey: parsed.lastNotifiedDateKey || null,
    };
  } catch {
    return { enabled: false, reminderTime: '08:00', lastNotifiedDateKey: null };
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    Boolean(nav.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export async function registerRebuildServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const base = import.meta.env.BASE_URL || './';
    const reg = await navigator.serviceWorker.register(`${base}sw.js`);
    return reg;
  } catch {
    return null;
  }
}

export async function requestAppNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return 'denied';
  }
}

export async function sendAppNotification(title: string, body: string): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: 'rebuild-reminder',
        });
        return true;
      }
    }
    new Notification(title, { body, icon: './icons/icon-192.png' });
    return true;
  } catch {
    return false;
  }
}

export function getJstHHMM(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
