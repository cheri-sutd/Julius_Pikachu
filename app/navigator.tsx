// auth user and state
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';

// UI components and layouts
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// component
import Sidepanel, { SidepanelItem } from '../components/Sidepanel';

//utils
import { Role } from './utils/auth/roles';

// routes
import Dashboard from './screens/dashboard';
import Settings from './screens/settings';


type RouteKey = 'dashboard' | 'settings';

// giving role-specific access
const routeMap: Record<Role, SidepanelItem[]> = {
  ops: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'settings', label: 'Settings' },
  ],
  legal: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'settings', label: 'Settings' },
  ],
  front: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'settings', label: 'Settings' },
  ],
  comp: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'settings', label: 'Settings' },
  ],
}
const getRoutes = (role: Role): SidepanelItem[] => routeMap[role] ?? [];

export function NativeNavigator() {
  // TODO: Derive role from authenticated user/claims; default to 'ops' for now
  const role: Role = 'ops';
  const [active, setActive] = useState<RouteKey>('dashboard'); // tracks currently active route defaults to dashboard
  const [resetMap, setResetMap] = useState<Record<RouteKey, number>>({
    dashboard: 0,
    settings: 0,
  }); // to force re-renders components when the same route is selected again 
  const items = useMemo(() => getRoutes(role), [role]); // list of allowed routes for current role
  const allowed = useMemo(() => items.map(i => i.key as RouteKey), [items]); // list of allowed route "keys" for current role
  useEffect(() => {
    if (!allowed.includes(active)) {
      setActive('dashboard');
    }
  }, [active, allowed]); // route guarding: ensure active route is valid for current role if not default to dashboard

  //for the main content area
  const routeComponents: Partial<Record<RouteKey, React.ReactElement | null>> = {
    dashboard: allowed.includes('dashboard') ? <Dashboard /> : null,
    settings: allowed.includes('settings') ? <Settings resetKey={resetMap.settings} /> : null,
  };
  
  return (
    <View style={styles.root}>
      {/* sidepanel navigation */}
      <Sidepanel
        items={items}
        activeKey={active}
        onSelect={(key) => {
          const k = key as RouteKey;
          if (k === active) {
            setResetMap((prev) => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }));
          } else {
            setActive(k);
          }
        }}
      />
      <View style={styles.content}>
        {/* Topbar with sign out button */}
        <View style={styles.topbar}>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.signOutBtn} onPress={() => signOut(auth)}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
        {/* Main content area */}
        {routeComponents[active]}
      </View>
    </View>
  );
}

export default NativeNavigator;

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, padding: 16 },
  topbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  signOutBtn: { backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  signOutText: { color: '#333', fontFamily: 'Inter-SemiBold' },
});