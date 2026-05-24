import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB64nDJiEPS-JQJwBm3AtLaXJNsXQqnNk0',
  authDomain: 'bloom-luxe-test.firebaseapp.com',
  projectId: 'bloom-luxe-test',
  storageBucket: 'bloom-luxe-test.firebasestorage.app',
  messagingSenderId: '381744615197',
  appId: '1:381744615197:web:e1c719348ba2d4d53a5bf4',
  measurementId: 'G-NKQ235VRP6',
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);
export { app, analytics };
