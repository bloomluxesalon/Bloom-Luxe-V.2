import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyD9MxQNhtlwMjT7u7LuXDxm98r4TzyCQNc',
  authDomain: 'bloom-db-ec1b6.firebaseapp.com',
  projectId: 'bloom-db-ec1b6',
  storageBucket: 'bloom-db-ec1b6.firebasestorage.app',
  messagingSenderId: '195797259146',
  appId: '1:195797259146:web:b9f188227ad7e5217b6e73',
  measurementId: 'G-08ST5Q9BGL',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export { app, analytics };
