// auth user and state
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';

// UI components and layouts
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import Navigator from './navigator';
import Login from './screens/login';

// fonts and styling
import { useFonts } from 'expo-font';

// utils
import { normalizeRole, Role } from './utils/auth/roles';

export default function App() {
  // fonts available
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter_24pt-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter_24pt-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter_24pt-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter_24pt-Bold.ttf'),
  });

  // auth state
  //replace type with authuser after finalising database
  /*
  type AuthUser = {
    uid: string;
    email: string | null;
    // Add more fields if needed
  };
  */
  const [user, setUser] = useState<any>(null); // for user object
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  // set default font for all Text components
  useEffect(() => {
    if (fontsLoaded) {
      const AnyText: any = Text as any;
      AnyText.defaultProps = AnyText.defaultProps || {};
      AnyText.defaultProps.style = [AnyText.defaultProps.style, { fontFamily: 'Inter-Regular' }];
    }
  }, [fontsLoaded]);

  // auth state change listener
  useEffect(() => {
    const sub = onAuthStateChanged(auth, async (u) => { // for login and logout
      setUser(u);
      // if user is signed out, clear role and return early
      if (!u) {
        console.log('[auth] signed out; clearing role');
        setRole(null);
        setReady(true);
        return;
      }
      try {
        // read role from users/{uid} (doc ID is auth uid)
        const snap = await getDoc(doc(db, 'users', u.uid)); // get user document
        const rawRole = snap.exists() ? ((snap.data() as any)?.role as string | undefined) : undefined; // get role from document
        const status = snap.exists() ? ((snap.data() as any)?.status as string | undefined) : undefined; // get status from document
        const normalized = normalizeRole(rawRole);
        // deny access for all retirees
        // check for worker/staff role and denies access (later decide for supervisor too)
        if (status === 'retired') {
          // may want to do normalization for this too later
          window.alert('Access denied: You are retired.');
          console.warn(`retired; signing out`);
          await signOut(auth);
          setRole(null);
        } else if (normalized as Role) {
          console.log('[auth] role resolved', { uid: u.uid, email: u.email, role: normalized });
          setRole(normalized as Role);
        } else {
          // Fallback: do not sign out; default to a safe role
          console.warn('[auth] unknown role; defaulting to "legal"');
          setRole('legal' as Role);
        }
      } catch (e: any) {
        // Enhanced error handling for Firestore connection issues
        console.error('[auth] role fetch failed:', e);
        
        // Check if it's a network/connection error
        if (e?.code === 'unavailable' || e?.message?.includes('Failed to get document') || e?.message?.includes('network')) {
          console.warn('[auth] Network error detected, retrying in 2 seconds...');
          // Retry after a short delay
          setTimeout(async () => {
            try {
              const retrySnap = await getDoc(doc(db, 'users', u.uid));
              const retryRole = retrySnap.exists() ? ((retrySnap.data() as any)?.role as string | undefined) : undefined;
              const retryNormalized = normalizeRole(retryRole);
              setRole((retryNormalized as Role) || 'legal');
              console.log('[auth] Retry successful, role:', retryNormalized);
            } catch (retryError) {
              console.warn('[auth] Retry failed, defaulting to legal role:', retryError);
              setRole('legal' as Role);
            }
          }, 2000);
        } else {
          // For other errors, fallback immediately
          setRole('legal' as Role);
        }
      }
      setReady(true);
    });
    return () => sub();
  }, []);

  if (!fontsLoaded || !ready) return null;
  if (!user) return <Login />;
  if (!role) return null;
  return <Navigator role={role} />;
}