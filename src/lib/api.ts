import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { QueueItem, SystemSettings } from '../types';

const API_URL = import.meta.env.VITE_GAS_API_URL;
const QUEUE_CACHE_KEY = 'bloom_luxe_queue_cache';
const SETTINGS_CACHE_KEY = 'bloom_luxe_settings_cache';

const defaultSettings: SystemSettings = {
  id: 'SYS_SETTINGS',
  staffLineIds: ['', '', '', '', '', ''],
};

const validStatuses: QueueItem['status'][] = ['Pending', 'Waiting', 'Serving', 'Completed', 'Cancelled', 'Archived'];
const validOrderTypes: QueueItem['orderType'][] = ['walkin', 'booking'];

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

const stripUndefinedFields = <T extends Record<string, any>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T;
};

const normalizeQueue = (item: QueueItem): QueueItem => {
  const now = new Date().toISOString();
  const createdAt = item.createdAt || item.timestamp || now;
  const completedAt = item.status === 'Completed' ? item.completedAt || now : item.completedAt;

  return stripUndefinedFields({
    ...item,
    id: String(item.id || '').trim(),
    orderType: validOrderTypes.includes(item.orderType) ? item.orderType : 'walkin',
    nickname: String(item.nickname || '').trim(),
    phone: String(item.phone || '').trim(),
    course: String(item.course || '').trim(),
    bookingDate: String(item.bookingDate || '').trim(),
    bookingTime: String(item.bookingTime || '').trim(),
    gender: String(item.gender || '').trim(),
    waterTemp: String(item.waterTemp || '').trim(),
    oil: String(item.oil || '').trim(),
    shampoo: String(item.shampoo || '').trim(),
    massagePressure: String(item.massagePressure || '').trim(),
    headPressure: String(item.headPressure || '').trim(),
    caution: String(item.caution || '').trim(),
    status: validStatuses.includes(item.status) ? item.status : 'Waiting',
    timestamp: item.timestamp || createdAt,
    createdAt,
    updatedAt: now,
    completedAt,
    isPaid: Boolean(item.isPaid),
    isDepositPaid: Boolean(item.isDepositPaid),
    actualPrice: typeof item.actualPrice === 'number' ? item.actualPrice : undefined,
    internalNote: item.internalNote?.trim(),
    serviceStartTime: item.serviceStartTime,
    notifiedNext: item.notifiedNext,
    lineUserId: item.lineUserId?.trim(),
    lineDisplayName: item.lineDisplayName?.trim(),
    linePictureUrl: item.linePictureUrl,
    discount: item.discount?.trim(),
  });
};

const validateQueue = (item: QueueItem) => {
  if (!item.id) throw new Error('Queue id is required.');
  if (!item.nickname) throw new Error(`Queue ${item.id}: nickname is required.`);
  if (!item.bookingDate) throw new Error(`Queue ${item.id}: booking date is required.`);
  if (!item.bookingTime) throw new Error(`Queue ${item.id}: booking time is required.`);
  if (!validStatuses.includes(item.status)) throw new Error(`Queue ${item.id}: invalid status.`);
  if (!validOrderTypes.includes(item.orderType)) throw new Error(`Queue ${item.id}: invalid order type.`);
  if (item.actualPrice !== undefined && (Number.isNaN(item.actualPrice) || item.actualPrice < 0)) {
    throw new Error(`Queue ${item.id}: actual price must be a positive number.`);
  }
};

const normalizeSettings = (settings: SystemSettings): SystemSettings => ({
  id: 'SYS_SETTINGS',
  staffLineIds: Array.from({ length: 6 }, (_, index) => settings.staffLineIds?.[index]?.trim() || ''),
});

const sortQueues = (queues: QueueItem[]) =>
  [...queues].sort((a, b) => {
    const dateCompare = `${a.bookingDate || ''} ${a.bookingTime || ''}`.localeCompare(`${b.bookingDate || ''} ${b.bookingTime || ''}`);
    if (dateCompare !== 0) return dateCompare;
    return (a.createdAt || a.timestamp || '').localeCompare(b.createdAt || b.timestamp || '');
  });

const comparableQueue = (item: QueueItem) => {
  const { updatedAt, ...rest } = stripUndefinedFields(item);
  return rest;
};

const getFallbackDatabase = (): { queues: QueueItem[]; settings: SystemSettings } => {
  const queues = readCache<QueueItem[]>(QUEUE_CACHE_KEY) || [];
  const settings = readCache<SystemSettings>(SETTINGS_CACHE_KEY) || defaultSettings;
  return { queues: sortQueues(queues), settings };
};

export const fetchDatabase = async (): Promise<{ queues: QueueItem[]; settings: SystemSettings }> => {
  try {
    const queueSnapshot = await getDocs(queueCollection);
    const queues = queueSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as QueueItem[];

    const settingsSnapshot = await getDoc(settingsDoc);
    const settingsData = settingsSnapshot.exists()
      ? normalizeSettings(settingsSnapshot.data() as SystemSettings)
      : defaultSettings;

    const result = {
      queues: sortQueues(queues),
      settings: settingsData,
    };

    writeCache(QUEUE_CACHE_KEY, result.queues);
    writeCache(SETTINGS_CACHE_KEY, result.settings);

    return result;
  } catch (err: any) {
    console.warn('Firestore unavailable, using cached local data.', err);
    return getFallbackDatabase();
  }
};

export const saveQueues = async (nextQueues: QueueItem[], previousQueues: QueueItem[]) => {
  const batch = writeBatch(db);
  const previousById = new Map(previousQueues.map((item) => [item.id, item]));
  const nextById = new Map(nextQueues.map((item) => [item.id, item]));
  const normalizedNextQueues = nextQueues.map(normalizeQueue);
  const normalizedById = new Map(normalizedNextQueues.map((item) => [item.id, item]));
  let writeCount = 0;

  normalizedNextQueues.forEach(validateQueue);

  normalizedNextQueues.forEach((item) => {
    const previous = previousById.get(item.id);
    const changed = !previous || JSON.stringify(comparableQueue(item)) !== JSON.stringify(comparableQueue(normalizeQueue(previous)));

    if (changed) {
      batch.set(doc(db, 'queues', item.id), stripUndefinedFields(item));
      writeCount += 1;
    }
  });

  previousQueues.forEach((item) => {
    if (!nextById.has(item.id)) {
      batch.delete(doc(db, 'queues', item.id));
      writeCount += 1;
    }
  });

  if (writeCount === 0) return { success: true, queues: sortQueues(previousQueues) };

  try {
    await batch.commit();
    const savedById = new Map(previousQueues.map((item) => [item.id, item]));
    previousQueues.forEach((item) => {
      if (!nextById.has(item.id)) savedById.delete(item.id);
    });
    normalizedNextQueues.forEach((item) => savedById.set(item.id, item));
    const savedQueues = sortQueues(Array.from(savedById.values()));

    writeCache(QUEUE_CACHE_KEY, savedQueues);

    return { success: true, queues: savedQueues };
  } catch (err: any) {
    console.warn('Firestore save failed. Local cache was not treated as a successful save.', err);
    writeCache(QUEUE_CACHE_KEY, sortQueues(nextQueues));
    throw err;
  }
};

export const saveSettings = async (settings: SystemSettings) => {
  const normalizedSettings = normalizeSettings(settings);

  try {
    await writeBatch(db).set(settingsDoc, normalizedSettings).commit();
    writeCache(SETTINGS_CACHE_KEY, normalizedSettings);
    return { success: true, settings: normalizedSettings };
  } catch (err: any) {
    console.warn('Firestore settings save failed. Local cache was not treated as a successful save.', err);
    writeCache(SETTINGS_CACHE_KEY, normalizedSettings);
    throw err;
  }
};

export const saveDatabase = async (queues: QueueItem[], settings: SystemSettings) => {
  const data = await fetchDatabase();
  const queueResult = await saveQueues(queues, data.queues);
  const settingsResult = await saveSettings(settings);
  return { success: true, queues: queueResult.queues, settings: settingsResult.settings };
};

export const sendLineNotification = async (userId: string, message: string) => {
  if (!API_URL) {
    console.warn("Cannot send notification because VITE_GAS_API_URL is not configured.");
    return;
  }

  const payload = {
    action: "notify",
    userId,
    message,
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log("LINE notify response:", text);

    return text;
  } catch (e) {
    console.error("Notify failed", e);
  }
};
