import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TextInput, Pressable } from 'react-native';
import { api } from '../utils/api';

export default function RemediationTasks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [riskSearch, setRiskSearch] = useState('');
  const [regSearch, setRegSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.remediationTasks();
        if (mounted) setTasks(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load remediation tasks');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const c = clientSearch.trim().toLowerCase();
    const r = riskSearch.trim().toLowerCase();
    const g = regSearch.trim().toLowerCase();
    return tasks.filter((item) => {
      const client = String(item.customer_id || '').toLowerCase();
      const risk = String(item.risk_category || '').toLowerCase();
      const reg = String(item.regulator || '').toLowerCase();
      const okC = c ? client.includes(c) : true;
      const okR = r ? risk.includes(r) : true;
      const okG = g ? reg.includes(g) : true;
      return okC && okR && okG;
    });
  }, [tasks, clientSearch, riskSearch, regSearch]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Remediation Tasks</Text>
      <View style={styles.filtersRow}>
        <TextInput
          placeholder="Search by Client ID"
          value={clientSearch}
          onChangeText={setClientSearch}
          style={styles.input}
        />
        <TextInput
          placeholder="Search by Risk Category"
          value={riskSearch}
          onChangeText={setRiskSearch}
          style={styles.input}
        />
        <TextInput
          placeholder="Search by Regulator"
          value={regSearch}
          onChangeText={setRegSearch}
          style={styles.input}
        />
        <Pressable style={styles.searchBtn} onPress={() => { /* client-side filter triggers render */ }}>
          <Text style={styles.searchText}>Filter</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => String(item.transaction_id || idx)}
          renderItem={({ item }) => (
            <View style={styles.task}>
              <Text style={styles.taskTitle}>Txn {item.transaction_id} • {item.risk_category}</Text>
              <Text style={styles.taskMeta}>{item.customer_id || ''} • {item.regulator || ''}</Text>
              <Text style={styles.body}>Actions:</Text>
              {Array.isArray(item.actions) && item.actions.length > 0 ? (
                item.actions.map((a: string, idx: number) => (
                  <Text key={idx} style={styles.action}>• {a}</Text>
                ))
              ) : (
                <Text style={styles.action}>• Review case details and document outcome</Text>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.body}>No remediation tasks available.</Text>}
          contentContainerStyle={{ paddingTop: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  title: { fontSize: 22, fontFamily: 'Inter-SemiBold', marginBottom: 8 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  input: { borderColor: '#ccc', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, minWidth: 160 },
  searchBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  searchText: { color: '#fff', fontFamily: 'Inter-SemiBold' },
  body: { fontSize: 14, fontFamily: 'Inter-Regular' },
  error: { color: '#b00020', marginTop: 8 },
  task: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  taskTitle: { fontSize: 16, fontWeight: '600' },
  taskMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  action: { fontSize: 13, color: '#333', marginTop: 4 },
});