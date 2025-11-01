import { initializeApp } from 'firebase/app';

// Optionally import the services that you want to use
import { getAuth } from 'firebase/auth';
// import {...} from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyACaoYxR9Mu8OcVP6zeMPBEGQHMDa_tfPw",
  authDomain: "julius-pikachu.firebaseapp.com",
  projectId: "julius-pikachu",
  storageBucket: "julius-pikachu.firebasestorage.app",
  messagingSenderId: "350960638983",
  appId: "1:350960638983:web:7bd657515ef43fa08f9ea2",
  measurementId: "G-X833J3GSW2"
};

const app = initializeApp(firebaseConfig);
// For more information on how to access Firebase in your project,
// see the Firebase documentation: https://firebase.google.com/docs/web/setup#access-firebase

// Export initialized services for use across the app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export default app;