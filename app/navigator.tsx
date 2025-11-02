// auth user and state
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';

// UI components and layouts
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// component
import Sidepanel, { SidepanelItem } from '../components/Sidepanel';

//utils
import { Role } from './utils/auth/roles';

// routes
import Alerts from './screens/alerts';
import AuditTrail from './screens/audit';
import DocumentValidator from './screens/documentvalidator';
import ExportReports from './screens/export';
import RemediationTasks from './screens/remediation';
import RiskScoring from './screens/risk';
import Settings from './screens/settings';

type RouteKey =
  | 'alerts'
  | 'documents'
  | 'risk'
  | 'audit'
  | 'remediation'
  | 'export'
  | 'settings';

const labelMap: Record<RouteKey, string> = {
  alerts: 'Alerts',
  documents: 'Documents',
  risk: 'Risk Scoring',
  audit: 'Audit Trail',
  remediation: 'Remediation Tasks',
  export: 'Export Reports',
  settings: 'Settings',
};

// Default access based on your new Firestore role structure
// Routes are accessible if the role has any permission string (not "no access")
const defaultPermissions: Record<Role, Record<RouteKey, boolean>> = {
  ops: {
    alerts: false, // operations role doesn't have alerts in your structure
    documents: false, // "no access"
    risk: true, // "view all and revaluation"
    audit: true, // "view and export"
    remediation: true, // "monitor resolution rate"
    export: true, // "full access"
    settings: false, // "no access"
  },
  legal: {
    alerts: true, // "view escalated or unresolved"
    documents: true, // "view all with audit trail"
    risk: false, // "no access"
    audit: true, // "full access"
    remediation: false, // "no access"
    export: true, // "full access"
    settings: false, // "no access"
  },
  front: {
    alerts: true, // "view clients only"
    documents: true, // "view clients only"
    risk: true, // "view clients only"
    audit: true, // "view clients only"
    remediation: true, // "view and respond"
    export: false, // "no access"
    settings: false, // "no access"
  },
  comp: {
    alerts: true, // "view validations only"
    documents: true, // "full access and validate"
    risk: true, // "view all and revaluation"
    audit: true, // "view and export"
    remediation: true, // "full access"
    export: true, // "export validation logs"
    settings: false, // "no access"
  },
  superadmin: {
    alerts: true, // "view all"
    documents: true, // "view only"
    risk: true, // "view only"
    audit: true, // "view and export"
    remediation: true, // "view only"
    export: true, // "full access"
    settings: true, // "full access"
  },
};

const toItems = (perms: Record<RouteKey, boolean>): SidepanelItem[] =>
  (Object.keys(perms) as RouteKey[])
    .filter((k) => perms[k])
    .map((k) => ({ key: k, label: labelMap[k] }));

export function Navigator({ role }: { role: Role }) {
  const [active, setActive] = useState<RouteKey>('alerts');
  const [auditInitialTxnId, setAuditInitialTxnId] = useState<string | undefined>(undefined);
  const [resetMap, setResetMap] = useState<Record<RouteKey, number>>({
    alerts: 0,
    documents: 0,
    risk: 0,
    audit: 0,
    remediation: 0,
    export: 0,
    settings: 0,
  });

  const [permissions, setPermissions] = useState<Record<RouteKey, boolean> | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string> | null>(null);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const userUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (userUnsubscribeRef.current) {
      userUnsubscribeRef.current();
      userUnsubscribeRef.current = null;
    }

    // Only subscribe to Firestore if user is authenticated
    if (!auth.currentUser) {
      console.log('[Navigator] No authenticated user, using default permissions');
      setPermissions(defaultPermissions[role]);
      return;
    }

    const unsub = onSnapshot(doc(db, 'roles', role), (snap) => {
      const data = snap.exists() ? (snap.data() as any) : null;
      if (data) {
        // Store the raw role permissions for use in other components
        setRolePermissions(data);
        
        const fallback = defaultPermissions[role];
        // Convert string permissions to boolean route access
        // Route is accessible if permission exists and is not "no access"
        const perms = {
          alerts: (data.alerts && data.alerts !== "no access") ?? fallback.alerts,
          documents: (data.documentvalidator && data.documentvalidator !== "no access") ?? fallback.documents,
          risk: (data.risk && data.risk !== "no access") ?? fallback.risk,
          audit: (data.audit && data.audit !== "no access") ?? fallback.audit,
          remediation: (data.remediation && data.remediation !== "no access") ?? fallback.remediation,
          export: (data.export && data.export !== "no access") ?? fallback.export,
          settings: (data.settings && data.settings !== "no access") ?? fallback.settings,
        } as Record<RouteKey, boolean>;
        setPermissions(perms);
      } else {
        setPermissions(defaultPermissions[role]);
        setRolePermissions(null);
      }
    }, (error) => {
      console.error('[Navigator] Firestore role subscription error:', error);
      setPermissions(defaultPermissions[role]);
      setRolePermissions(null);
    });
    
    unsubscribeRef.current = unsub;
    
    // Subscribe to current user's allowed clients for front-role scoping
    if (auth.currentUser) {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userUnsub = onSnapshot(userDocRef, (snap) => {
        const data = snap.exists() ? (snap.data() as any) : null;
        const clients = Array.isArray(data?.clients) ? data.clients.map((c: any) => String(c)) : [];
        setClientIds(clients);
      }, (error) => {
        console.error('[Navigator] Firestore user subscription error:', error);
        setClientIds([]);
      });
      userUnsubscribeRef.current = userUnsub;
    }
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (userUnsubscribeRef.current) {
        userUnsubscribeRef.current();
        userUnsubscribeRef.current = null;
      }
    };
  }, [role]);

  const items = useMemo(() => toItems(permissions ?? defaultPermissions[role]), [permissions, role]);
  const allowed = useMemo(() => items.map(i => i.key as RouteKey), [items]);
  
  useEffect(() => {
    if (!allowed.includes(active)) {
      // Find the first allowed route, defaulting to alerts if available
      const firstAllowed = allowed.find(route => route === 'alerts') || allowed[0];
      if (firstAllowed) {
        setActive(firstAllowed);
      }
    }
  }, [active, allowed]);

  // Proper logout function with cleanup
  const handleLogout = async () => {
    try {
      // Clean up Firestore subscriptions before logout
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (userUnsubscribeRef.current) {
        userUnsubscribeRef.current();
        userUnsubscribeRef.current = null;
      }
      
      // Add a small delay to allow connections to close gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Sign out from Firebase
      await signOut(auth);
    } catch (error) {
      console.error('Error during logout:', error);
      // Force sign out even if cleanup fails
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error('Force sign out also failed:', signOutError);
      }
    }
  };

  // removed dark/light mode toggle per requirements

  //for the main content area
  const routeComponents: Partial<Record<RouteKey, React.ReactElement | null>> = {
    alerts: allowed.includes('alerts') ? (
      <Alerts
        role={role}
        clientIds={clientIds}
        onOpenAudit={(txnId) => {
          setAuditInitialTxnId(txnId);
          setActive('audit');
        }}
      />
    ) : null,
    documents: allowed.includes('documents') ? <DocumentValidator /> : null,
    risk: allowed.includes('risk') ? <RiskScoring /> : null,
    audit: allowed.includes('audit') ? <AuditTrail initialTransactionId={auditInitialTxnId} /> : null,
    remediation: allowed.includes('remediation') ? <RemediationTasks /> : null,
    export: allowed.includes('export') ? <ExportReports /> : null,
    settings: allowed.includes('settings') ? <Settings resetKey={resetMap.settings} rolePermissions={rolePermissions} userRole={role} /> : null,
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
          <Pressable style={styles.signOutBtn} onPress={handleLogout}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
        {/* Main content area (scrollable) */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {routeComponents[active]}
        </ScrollView>
      </View>
    </View>
  );
}

export default Navigator;

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, padding: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  topbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  signOutBtn: { backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  signOutText: { color: '#333', fontFamily: 'Inter-SemiBold' },
});