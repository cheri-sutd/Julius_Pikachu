
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView, Platform } from 'react-native';
import { db, auth } from '../../services/firebaseConfig';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { allRoles, Role } from '../utils/auth/roles';

type Panel = 'home' | 'roles' | 'users';

const roleLabelMap: Record<string, string> = {
  ops: 'Operations',
  front: 'Front Teams',
  comp: 'Compliance Teams',
  legal: 'Legal Teams',
  superadmin: 'Super Admin',
};

interface SettingsPanelProps {
  resetKey?: number;
  rolePermissions?: Record<string, string> | null;
  userRole?: Role;
}

export default function SettingsPanel({ resetKey, rolePermissions, userRole }: SettingsPanelProps) {
  const [active, setActive] = useState<Panel>('home');
  const [roles, setRoles] = useState<{ name: string; label?: string; permissions?: Record<string, string> }[]>([]);
  const [users, setUsers] = useState<{ id: string; name?: string; email?: string; role?: string; status?: string; clients?: string[] }[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [clientInputs, setClientInputs] = useState<Record<string, string>>({});
  const rolesUnsubscribeRef = useRef<(() => void) | null>(null);
  const usersUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up previous subscription
    if (rolesUnsubscribeRef.current) {
      rolesUnsubscribeRef.current();
      rolesUnsubscribeRef.current = null;
    }

    // Only subscribe to Firestore if user is authenticated
    if (!auth.currentUser) {
      console.log('[Settings] No authenticated user, skipping Firestore subscription');
      return;
    }

    // Subscribe to Firestore roles with string permissions
    const unsub = onSnapshot(collection(db, 'roles'), (snap) => {
      const list: { name: string; label?: string; permissions?: Record<string, string> }[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const permissions: Record<string, string> = {};
        
        // Extract all permission fields (excluding metadata)
        Object.keys(data).forEach(key => {
          if (key !== 'name' && key !== 'createdAt' && typeof data[key] === 'string') {
            permissions[key] = data[key];
          }
        });

        list.push({
          name: d.id,
          label: data?.name || roleLabelMap[d.id] || d.id,
          permissions,
        });
      });

      // Add any missing default roles
      allRoles.forEach((key) => {
        if (!list.find((r) => r.name === key)) {
          list.push({ 
            name: key, 
            label: roleLabelMap[key] || key,
            permissions: getDefaultPermissions(key)
          });
        }
      });
      
      setRoles(list);
    }, (error) => {
      console.error('[Settings] Firestore roles subscription error:', error);
      Alert.alert('Connection Error', 'Unable to load roles. Please check your connection and try again.');
    });
    
    rolesUnsubscribeRef.current = unsub;
    return () => {
      if (rolesUnsubscribeRef.current) {
        rolesUnsubscribeRef.current();
        rolesUnsubscribeRef.current = null;
      }
    };
  }, []);

  // Subscribe to Firestore users
  useEffect(() => {
    // Clean up previous subscription
    if (usersUnsubscribeRef.current) {
      usersUnsubscribeRef.current();
      usersUnsubscribeRef.current = null;
    }

    // Only subscribe to Firestore if user is authenticated
    if (!auth.currentUser) {
      console.log('[Settings] No authenticated user, skipping users subscription');
      return;
    }

    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const next: { id: string; name?: string; email?: string; role?: string; status?: string; clients?: string[] }[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const status = (data?.status ?? 'active') as string;
        if (status === 'active') {
          next.push({ 
            id: d.id, 
            name: data?.name, 
            email: data?.email, 
            role: data?.role, 
            status,
            clients: data?.clients || []
          });
        }
      });
      setUsers(next);
    }, (error) => {
      console.error('[Settings] Firestore users subscription error:', error);
      Alert.alert('Connection Error', 'Unable to load users. Please check your connection and try again.');
    });
    
    usersUnsubscribeRef.current = unsub;
    return () => {
      if (usersUnsubscribeRef.current) {
        usersUnsubscribeRef.current();
        usersUnsubscribeRef.current = null;
      }
    };
  }, []);

  // Reset to Settings home when navigator triggers a reset
  useEffect(() => {
    setActive('home');
  }, [resetKey]);

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      if (rolesUnsubscribeRef.current) {
        rolesUnsubscribeRef.current();
      }
      if (usersUnsubscribeRef.current) {
        usersUnsubscribeRef.current();
      }
    };
  }, []);

  const getDefaultPermissions = (roleName: string): Record<string, string> => {
    switch (roleName) {
      case 'comp':
        return {
          alerts: "view validations only",
          audit: "view and export",
          documentvalidator: "full access and validate",
          export: "export validation logs",
          remediation: "full access",
          risk: "view all and revaluation",
          settings: "no access"
        };
      case 'front':
        return {
          alerts: "view clients only",
          audit: "view clients only",
          documentvalidator: "view clients only",
          export: "no access",
          remediation: "view and respond",
          risk: "view clients only",
          settings: "no access"
        };
      case 'legal':
        return {
          alerts: "view escalated or unresolved",
          audit: "full access",
          documentvalidator: "view all with audit trail",
          export: "full access",
          remediation: "no access",
          risk: "no access",
          settings: "no access"
        };
      case 'ops':
        return {
          audit: "view and export",
          documentvalidator: "no access",
          export: "full access",
          remediation: "monitor resolution rate",
          risk: "view all and revaluation",
          settings: "no access"
        };
      case 'superadmin':
        return {
          alerts: "view all",
          audit: "view and export",
          documentvalidator: "view only",
          export: "full access",
          remediation: "view only",
          risk: "view only",
          settings: "full access"
        };
      default:
        return {};
    }
  };

  const retireUser = async (userId: string) => {
    try {
      await setDoc(doc(db, 'users', userId), { status: 'retired' }, { merge: true });
      Alert.alert('User retired', 'User has been retired successfully');
    } catch (e: any) {
      Alert.alert('Retire user failed', e?.message ?? 'Unable to retire user');
    }
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      await setDoc(doc(db, 'users', userId), { role: newRole }, { merge: true });
      Alert.alert('Role updated', `User role changed to ${roleLabelMap[newRole] || newRole}`);
    } catch (e: any) {
      Alert.alert('Role change failed', e?.message ?? 'Unable to change user role');
    }
  };

  const addClientForUser = async (userId: string, clientIdRaw: string) => {
    try {
      const clientId = (clientIdRaw || '').trim();
      if (!clientId) {
        Alert.alert('Invalid client', 'Please enter a valid client ID');
        return;
      }
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? (snap.data() as any) : {};
      const existing: string[] = Array.isArray(data?.clients) ? data.clients.map((c: any) => String(c)) : [];
      if (existing.includes(clientId)) {
        Alert.alert('Already added', 'This client is already assigned');
        return;
      }
      const next = [...existing, clientId];
      await setDoc(userRef, { clients: next }, { merge: true });
      setClientInputs((m) => ({ ...m, [userId]: '' }));
      Alert.alert('Client added', `Assigned client "${clientId}" to user`);
    } catch (e: any) {
      Alert.alert('Add client failed', e?.message ?? 'Unable to add client');
    }
  };

  const removeClientForUser = async (userId: string, clientId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? (snap.data() as any) : {};
      const existing: string[] = Array.isArray(data?.clients) ? data.clients.map((c: any) => String(c)) : [];
      const next = existing.filter((c) => String(c) !== String(clientId));
      await setDoc(userRef, { clients: next }, { merge: true });
      Alert.alert('Client removed', `Removed client "${clientId}" from user`);
    } catch (e: any) {
      Alert.alert('Remove client failed', e?.message ?? 'Unable to remove client');
    }
  };

  if (active === 'home') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        
        {/* Current User Info */}
        {rolePermissions && userRole && (
          <View style={[styles.card, { marginBottom: 16 }]}>
            <Text style={styles.cardTitle}>Your Role: {roleLabelMap[userRole] || userRole}</Text>
            <Text style={styles.subtitle}>Your Permissions:</Text>
            {Object.entries(rolePermissions).map(([key, value]) => {
              if (key === 'name') return null;
              return (
                <View key={key} style={styles.permissionRow}>
                  <Text style={styles.permissionKey}>{key}:</Text>
                  <Text style={styles.permissionValue}>{value}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.menu}>
          <Pressable style={styles.menuBtnLarge} onPress={() => setActive('roles')}>
            <Text style={styles.menuTextLarge}>Manage Roles</Text>
          </Pressable>
          <Pressable style={styles.menuBtnLarge} onPress={() => setActive('users')}>
            <Text style={styles.menuTextLarge}>Manage Users</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (active === 'roles') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Role Management</Text>
          <Pressable style={styles.backBtn} onPress={() => setActive('home')}>
            <Text>Back</Text>
          </Pressable>
        </View>

        <ScrollView>
          {roles.map((role) => (
            <View key={role.name} style={styles.roleRow}>
              <View style={styles.roleHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleTitle}>{role.label || role.name}</Text>
                  <Text style={styles.roleSubtitle}>Key: {role.name}</Text>
                </View>
                <Pressable
                  style={styles.expandBtn}
                  onPress={() => setExpandedRole(expandedRole === role.name ? null : role.name)}
                >
                  <Text style={styles.expandText}>
                    {expandedRole === role.name ? 'Hide' : 'Show'} Permissions
                  </Text>
                </Pressable>
              </View>

              {expandedRole === role.name && role.permissions && (
                <View style={styles.permissionsContainer}>
                  <Text style={styles.permissionsTitle}>Permissions:</Text>
                  {Object.entries(role.permissions).map(([key, value]) => (
                    <View key={key} style={styles.permissionRow}>
                      <Text style={styles.permissionKey}>{key}:</Text>
                      <Text style={styles.permissionValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (active === 'users') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>User Management</Text>
          <Pressable style={styles.backBtn} onPress={() => setActive('home')}>
            <Text>Back</Text>
          </Pressable>
        </View>

        <ScrollView>
          {users.map((user) => (
            <View key={user.id} style={styles.userRow}>
              <View style={styles.userHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.name || user.email || user.id}</Text>
                  <Text style={styles.userDetails}>
                    Role: {roleLabelMap[user.role || ''] || user.role || 'None'}
                  </Text>
                  {user.role === 'front' && user.clients && user.clients.length > 0 && (
                    <Text style={styles.userDetails}>
                      Clients: {user.clients.join(', ')}
                    </Text>
                  )}
                </View>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.expandBtn}
                    onPress={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                  >
                    <Text style={styles.expandText}>
                      {expandedUser === user.id ? 'Hide' : 'Actions'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {expandedUser === user.id && (
                <View style={styles.actionsContainer}>
                  <Text style={styles.actionsTitle}>Change Role:</Text>
                  <View style={styles.roleButtons}>
                    {allRoles.map((roleKey) => (
                      <Pressable
                        key={roleKey}
                        style={[
                          styles.roleChoiceBtn,
                          user.role === roleKey && styles.activeRoleBtn
                        ]}
                        onPress={() => changeUserRole(user.id, roleKey)}
                      >
                        <Text style={styles.roleChoiceText}>
                          {roleLabelMap[roleKey] || roleKey}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {userRole === 'superadmin' && user.role === 'front' && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.actionsTitle}>Manage Clients for Front User:</Text>
                      <View style={styles.clientManageRow}>
                        <TextInput
                          style={styles.clientInput}
                          placeholder="Enter client ID"
                          value={clientInputs[user.id] || ''}
                          onChangeText={(t) => setClientInputs((m) => ({ ...m, [user.id]: t }))}
                        />
                        <Pressable
                          style={styles.clientAddBtn}
                          onPress={() => addClientForUser(user.id, clientInputs[user.id] || '')}
                        >
                          <Text style={styles.clientAddText}>Add Client</Text>
                        </Pressable>
                      </View>
                      {(user.clients || []).length > 0 ? (
                        <View style={styles.clientListBox}>
                          {user.clients!.map((cid) => (
                            <View key={cid} style={styles.clientRow}>
                              <Text style={styles.clientText}>{cid}</Text>
                              <Pressable
                                style={styles.clientRemoveBtn}
                                onPress={() => removeClientForUser(user.id, cid)}
                              >
                                <Text style={styles.clientRemoveText}>Remove</Text>
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.userDetails}>No clients assigned yet.</Text>
                      )}
                    </View>
                  )}
                  <Pressable
                    style={styles.retireBtn}
                    onPress={() => retireUser(user.id)}
                  >
                    <Text style={styles.retireText}>Retire User</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  title: { fontSize: 22, fontFamily: 'Inter-SemiBold', marginBottom: 12 },
  subtitle: { fontSize: 18, fontFamily: 'Inter-SemiBold', flex: 1 },
  menu: { flexDirection: 'row', gap: 12 },
  menuBtnLarge: { 
    backgroundColor: '#0A7EA4', 
    flex: 1, 
    minHeight: 100, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  menuTextLarge: { color: '#fff', fontFamily: 'Inter-Bold', fontSize: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  
  // Role styles
  roleRow: { 
    flexDirection: 'column', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    paddingVertical: 12 
  },
  roleHeader: { flexDirection: 'row', alignItems: 'center' },
  roleTitle: { fontSize: 16, fontFamily: 'Inter-SemiBold' },
  roleSubtitle: { fontSize: 14, color: '#666', fontFamily: 'Inter-Regular' },
  expandBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  expandText: { color: '#fff', fontFamily: 'Inter-Medium' },
  permissionsContainer: { marginTop: 12, paddingLeft: 16 },
  permissionsTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', marginBottom: 8 },
  
  // User styles
  userRow: { 
    flexDirection: 'column', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    paddingVertical: 12 
  },
  userHeader: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 16, fontFamily: 'Inter-SemiBold' },
  userDetails: { fontSize: 14, color: '#666', fontFamily: 'Inter-Regular' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionsContainer: { marginTop: 12, paddingLeft: 16 },
  actionsTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', marginBottom: 8 },
  roleButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  roleChoiceBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  activeRoleBtn: { backgroundColor: '#16a34a' },
  roleChoiceText: { color: '#fff', fontFamily: 'Inter-Medium' },
  retireBtn: { backgroundColor: '#b00020', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  retireText: { color: '#fff', fontFamily: 'Inter-Medium' },
  clientManageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  clientAddBtn: { backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  clientAddText: { color: '#fff', fontFamily: 'Inter-Medium' },
  clientListBox: { marginTop: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 6, padding: 8 },
  clientRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  clientText: { fontSize: 14, color: '#333', fontFamily: 'Inter-Regular' },
  clientRemoveBtn: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  clientRemoveText: { color: '#fff', fontFamily: 'Inter-Medium' },
  
  // Permission display styles
  permissionRow: { flexDirection: 'row', marginBottom: 4 },
  permissionKey: { 
    fontSize: 14, 
    fontFamily: 'Inter-Medium', 
    minWidth: 120, 
    color: '#333' 
  },
  permissionValue: { 
    fontSize: 14, 
    fontFamily: 'Inter-Regular', 
    flex: 1, 
    color: '#666' 
  },
  
  // Card styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
});
