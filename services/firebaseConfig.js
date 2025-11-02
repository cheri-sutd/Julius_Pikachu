import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../secrets/firebase';

// Optionally import the services that you want to use
import { getAuth } from 'firebase/auth';
// import {...} from 'firebase/database';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Initialize Firebase using centralized secrets

const app = initializeApp(firebaseConfig);
// For more information on how to access Firebase in your project,
// see the Firebase documentation: https://firebase.google.com/docs/web/setup#access-firebase

// Export initialized services for use across the app
export const auth = getAuth(app);
// Use auto-detected long polling to avoid aborted WebChannel requests in some networks
// Also enable offline persistence for better reliability
// Reduce Firestore SDK log noise to errors only (hides benign aborted channel logs)
setLogLevel('error');
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
  // Add cache size limit for web
  cacheSizeBytes: 40000000, // 40MB cache
});
export const functions = getFunctions(app);
export default app;