import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD9MxQNhtlwMjT7u7LuXDxm98r4TzyCQNc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'bloom-db-ec1b6.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'bloom-db-ec1b6',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'bloom-db-ec1b6.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '195797259146',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:195797259146:web:b9f188227ad7e5217b6e73',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-08ST5Q9BGL',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export { app, analytics };
