import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { QueueItem, SystemSettings } from '../types';

const API_URL = import.meta.env.VITE_GAS_API_URL;
const QUEUE_CACHE_KEY = 'bloom_luxe_queue_cache';
const SETTINGS_CACHE_KEY = 'bloom_luxe_settings_cache';

if (!API_URL) {
  console.warn('VITE_GAS_API_URL is not set. sendLineNotification will be disabled unless a valid API endpoint is configured.');
}

const queueCollection = collection(db, 'queues');
const settingsDoc = doc(db, 'metadata', 'SYS_SETTINGS');

const readCache = <T>(key: string): T | null => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeCache = <T>(key: string, value: T) => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
};

const getFallbackDatabase = (): { queues: QueueItem[]; settings: SystemSettings } => {
  const queues = readCache<QueueItem[]>(QUEUE_CACHE_KEY) || [];
  const settings = readCache<SystemSettings>(SETTINGS_CACHE_KEY) || { id: 'SYS_SETTINGS', staffLineIds: ['', '', '', '', '', ''] };
  return { queues, settings };
};

export const fetchDatabase = async (): Promise<{ queues: QueueItem[]; settings: SystemSettings }> => {
  try {
    const queueSnapshot = await getDocs(queueCollection);
    const queues: QueueItem[] = queueSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as QueueItem[];

    const settingsSnapshot = await getDoc(settingsDoc);
    const settingsData = settingsSnapshot.exists()
      ? settingsSnapshot.data()
      : { id: 'SYS_SETTINGS', staffLineIds: ['', '', '', '', '', ''] };

    const result = {
      queues,
      settings: settingsData as SystemSettings,
    };

    writeCache(QUEUE_CACHE_KEY, result.queues);
    writeCache(SETTINGS_CACHE_KEY, result.settings);

    return result;
  } catch (err: any) {
    console.warn('Firestore unavailable, using cached local data.', err);
    return getFallbackDatabase();
  }
};

export const saveDatabase = async (queues: QueueItem[], settings: SystemSettings) => {
  try {
    const batch = writeBatch(db);

    const existingSnapshots = await getDocs(queueCollection);
    const existingIds = new Set(existingSnapshots.docs.map((docItem) => docItem.id));
    const nextIds = new Set(queues.map((item) => item.id));

    existingSnapshots.docs.forEach((docItem) => {
      if (!nextIds.has(docItem.id)) {
        batch.delete(doc(db, 'queues', docItem.id));
      }
    });

    queues.forEach((item) => {
      batch.set(doc(db, 'queues', item.id), item);
    });

    batch.set(settingsDoc, settings);

    await batch.commit();

    writeCache(QUEUE_CACHE_KEY, queues);
    writeCache(SETTINGS_CACHE_KEY, settings);

    return { success: true };
  } catch (err: any) {
    console.warn('Firestore save failed, using local cache instead.', err);
    writeCache(QUEUE_CACHE_KEY, queues);
    writeCache(SETTINGS_CACHE_KEY, settings);
    return { success: true };
  }
};

export const sendLineNotification = async (userId: string, message: string) => {
  if (!API_URL) {
    console.warn('Cannot send notification because VITE_GAS_API_URL is not configured.');
    return;
  }

  const payload = {
    action: 'notify',
    userId,
    message,
  };

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('Notify failed', e);
  }
};
