import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || path.resolve(process.cwd(), 'serviceAccountKey.json');
const databaseFile = path.resolve(process.cwd(), 'database.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Firebase service account file not found: ${serviceAccountPath}`);
  console.error('Please set FIREBASE_SERVICE_ACCOUNT_KEY_PATH or place serviceAccountKey.json in the project root.');
  process.exit(1);
}

if (!fs.existsSync(databaseFile)) {
  console.error(`database.json not found in project root: ${databaseFile}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

interface QueueItem {
  id: string;
  orderType: string;
  nickname: string;
  phone: string;
  course: string;
  bookingDate: string;
  bookingTime: string;
  gender: string;
  waterTemp: string;
  oil: string;
  shampoo: string;
  massagePressure: string;
  headPressure: string;
  caution?: string;
  status: string;
  timestamp: string;
  isPaid: boolean;
  isDepositPaid: boolean;
  actualPrice?: number;
  internalNote?: string;
  serviceStartTime?: string;
  notifiedNext?: boolean;
  lineUserId?: string;
  discount?: string;
}

interface SystemSettings {
  id: 'SYS_SETTINGS';
  staffLineIds: string[];
}

const main = async () => {
  const raw = fs.readFileSync(databaseFile, 'utf8');
  const records = JSON.parse(raw) as Array<QueueItem | SystemSettings>;

  const settingsRecord = records.find((item: any) => item.id === 'SYS_SETTINGS') as SystemSettings | undefined;
  const queueRecords = records.filter((item: any) => item.id !== 'SYS_SETTINGS') as QueueItem[];

  if (!settingsRecord) {
    console.warn('SYS_SETTINGS record not found in database.json. A default settings document will be created.');
  }

  console.log(`Found ${queueRecords.length} queue records.`);
  console.log(`Writing ${settingsRecord ? 'SYS_SETTINGS document' : 'default settings document'}.`);

  const queueCollection = db.collection('queues');
  const metadataDoc = db.collection('metadata').doc('SYS_SETTINGS');

  const existingSnapshot = await queueCollection.get();
  const existingIds = new Set(existingSnapshot.docs.map((doc) => doc.id));
  const newIds = new Set(queueRecords.map((item) => item.id));

  const batch = db.batch() as WriteBatch;

  queueRecords.forEach((item) => {
    const ref = queueCollection.doc(item.id);
    batch.set(ref, item);
  });

  existingSnapshot.docs.forEach((doc) => {
    if (!newIds.has(doc.id)) {
      batch.delete(queueCollection.doc(doc.id));
    }
  });

  const settings: SystemSettings = settingsRecord || { id: 'SYS_SETTINGS', staffLineIds: ['', '', '', '', '', ''] };
  batch.set(metadataDoc, settings);

  console.log('Committing batch write to Firestore...');
  await batch.commit();
  console.log('Import completed successfully.');
};

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
