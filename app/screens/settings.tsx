
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { db } from '../../services/firebaseConfig';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

type Panel = 'home' | 'roles' | 'language';

export default function SettingsPanel({ resetKey }: { resetKey?: number }) {
  const [active, setActive] = useState<Panel>('home');
  const [roles, setRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'roles'), (snap) => {
      const list: string[] = [];
      snap.forEach((d) => list.push(d.id));
      setRoles(list);
    });
    return () => unsub();
  }, []);

  // Reset to Settings home when navigator triggers a reset
  useEffect(() => {
    setActive('home');
    setEditingRole(null);
    setEditValue('');
  }, [resetKey]);

  useEffect(() => {
    // Load language from settings/app
    (async () => {
      try {
        const s = await getDoc(doc(db, 'settings', 'app'));
        const data = s.data();
        if (data?.language) setLanguage(String(data.language));
      } catch {}
    })();
  }, []);

  const addRole = async () => {
    const name = newRole.trim().toLowerCase();
    if (!name) return;
    try {
      await setDoc(doc(db, 'roles', name), { createdAt: Date.now() });
      setNewRole('');
      Alert.alert('Role added', `Added role "${name}"`);
    } catch (e: any) {
      Alert.alert('Add role failed', e?.message ?? 'Unable to add role');
    }
  };

  const removeRole = async (name: string) => {
    try {
      await deleteDoc(doc(db, 'roles', name));
      Alert.alert('Role removed', `Removed role "${name}"`);
    } catch (e: any) {
      Alert.alert('Remove role failed', e?.message ?? 'Unable to remove role');
    }
  };

  const startEditRole = (name: string) => {
    setEditingRole(name);
    setEditValue(name);
  };

  const cancelEditRole = () => {
    setEditingRole(null);
    setEditValue('');
  };

  const saveRoleRename = async () => {
    const oldName = editingRole;
    const newName = editValue.trim().toLowerCase();
    if (!oldName) return;
    if (!newName || newName === oldName) {
      cancelEditRole();
      return;
    }
    try {
      const oldSnap = await getDoc(doc(db, 'roles', oldName));
      const payload = oldSnap.exists() ? oldSnap.data() : { createdAt: Date.now() };
      await setDoc(doc(db, 'roles', newName), { ...payload, renamedFrom: oldName });
      await deleteDoc(doc(db, 'roles', oldName));
      Alert.alert('Role renamed', `"${oldName}" → "${newName}"`);
      cancelEditRole();
    } catch (e: any) {
      Alert.alert('Rename failed', e?.message ?? 'Unable to rename role');
    }
  };

  const saveLanguage = async () => {
    try {
      await setDoc(doc(db, 'settings', 'app'), { language }, { merge: true });
      Alert.alert('Language saved', `Current language: ${language}`);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unable to save language');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {active === 'home' && (
        <View style={styles.menu}>
          <Pressable style={styles.menuBtn} onPress={() => setActive('roles')}>
            <Text style={styles.menuText}>Roles</Text>
          </Pressable>
          <Pressable style={styles.menuBtn} onPress={() => setActive('language')}>
            <Text style={styles.menuText}>Language Settings</Text>
          </Pressable>
        </View>
      )}

      {active === 'roles' && (
        <View>
          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>Roles Manager</Text>
            <Pressable style={styles.backBtn} onPress={() => setActive('home')}><Text>Back</Text></Pressable>
          </View>
          <View style={styles.row}>
            <TextInput style={styles.input} placeholder="New role" value={newRole} onChangeText={setNewRole} />
            <Pressable style={styles.addBtn} onPress={addRole}>
              <Text style={{ color: '#fff', fontFamily: 'Inter-SemiBold' }}>Add</Text>
            </Pressable>
          </View>
          <View>
            {roles.map((r) => (
              <View key={r} style={styles.roleRow}>
                {editingRole === r ? (
                  <TextInput style={[styles.input, { flex: 1 }]} value={editValue} onChangeText={setEditValue} autoCapitalize="none" />
                ) : (
                  <Text style={{ flex: 1 }}>{r}</Text>
                )}
                {editingRole === r ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable style={styles.saveBtn} onPress={saveRoleRename}><Text style={{ color: '#fff' }}>Save</Text></Pressable>
                    <Pressable style={styles.cancelBtn} onPress={cancelEditRole}><Text>Cancel</Text></Pressable>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable style={styles.editBtn} onPress={() => startEditRole(r)}><Text style={{ color: '#fff' }}>Edit</Text></Pressable>
                    <Pressable style={styles.delBtn} onPress={() => removeRole(r)}><Text style={{ color: '#fff' }}>Delete</Text></Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {active === 'language' && (
        <View>
          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>Language Settings</Text>
            <Pressable style={styles.backBtn} onPress={() => setActive('home')}><Text>Back</Text></Pressable>
          </View>
          {/* Cross-platform language selector */}
          <View style={{ gap: 8, marginBottom: 12 }}>
            {['en','es','fr','de'].map((code) => {
              const selected = code === language;
              return (
                <Pressable
                  key={code}
                  onPress={() => setLanguage(code)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selected ? '#0A7EA4' : '#ccc',
                    backgroundColor: selected ? 'rgba(10,126,164,0.1)' : '#fff',
                  }}
                >
                  <Text style={{ fontFamily: 'Inter-Medium' }}>
                    {code === 'en' ? 'English' : code === 'es' ? 'Spanish' : code === 'fr' ? 'French' : 'German'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.addBtn} onPress={saveLanguage}>
            <Text style={{ color: '#fff', fontFamily: 'Inter-SemiBold' }}>Save</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  title: { fontSize: 22, fontFamily: 'Inter-SemiBold', marginBottom: 12 },
  menu: { flexDirection: 'row', gap: 8 },
  menuBtn: { backgroundColor: '#0A7EA4', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6 },
  menuText: { color: '#fff', fontFamily: 'Inter-SemiBold' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  subtitle: { fontSize: 18, fontFamily: 'Inter-SemiBold', flex: 1 },
  backBtn: { backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  addBtn: { backgroundColor: '#0A7EA4', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6 },
  roleRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 8 },
  editBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  saveBtn: { backgroundColor: '#16a34a', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  cancelBtn: { backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  delBtn: { backgroundColor: '#b00020', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
});
