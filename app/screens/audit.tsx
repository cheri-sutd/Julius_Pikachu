import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TextInput, Pressable } from 'react-native';
import { api } from '../utils/api';

export default function AuditTrail({ initialTransactionId }: { initialTransactionId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [txnSearch, setTxnSearch] = useState('');
  const [regSearch, setRegSearch] = useState('');
  const [jurSearch, setJurSearch] = useState('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.auditLogs();
        if (mounted) setLogs(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (initialTransactionId) {
      setTxnSearch(String(initialTransactionId));
    }
  }, [initialTransactionId]);

  const filtered = useMemo(() => {
    const t = txnSearch.trim().toLowerCase();
    const r = regSearch.trim().toLowerCase();
    const j = jurSearch.trim().toLowerCase();
    return logs.filter((item) => {
      const txn = String(item.transaction_id || '').toLowerCase();
      const reg = String(item.regulator || '').toLowerCase();
      const jur = String(item.booking_jurisdiction || '').toLowerCase();
      const okT = t ? txn.includes(t) : true;
      const okR = r ? reg.includes(r) : true;
      const okJ = j ? jur.includes(j) : true;
      return okT && okR && okJ;
    });
  }, [logs, txnSearch, regSearch, jurSearch]);

  useEffect(() => {
    if (initialTransactionId) {
      setTxnSearch(String(initialTransactionId));
    }
  }, [initialTransactionId]);

  // Reset page when filters or pageSize change
  useEffect(() => {
    setPage(1);
  }, [txnSearch, regSearch, jurSearch, pageSize, logs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paged = filtered.slice(startIdx, endIdx);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Audit Trail</Text>
      <View style={styles.filtersRow}>
        <TextInput
          placeholder="Search by Transaction ID"
          value={txnSearch}
          onChangeText={setTxnSearch}
          style={styles.input}
        />
        <TextInput
          placeholder="Search by Regulator"
          value={regSearch}
          onChangeText={setRegSearch}
          style={styles.input}
        />
        <TextInput
          placeholder="Search by Jurisdiction"
          value={jurSearch}
          onChangeText={setJurSearch}
          style={styles.input}
        />
        <Pressable style={styles.searchBtn} onPress={() => { /* client-side filter triggers render */ }}>
          <Text style={styles.searchText}>Filter</Text>
        </Pressable>
        <Pressable style={[styles.searchBtn, { backgroundColor: '#eee' }]} onPress={() => { setTxnSearch(''); setRegSearch(''); setJurSearch(''); }}>
          <Text style={[styles.searchText, { color: '#333' }]}>Clear</Text>
        </Pressable>
      </View>
      <View style={styles.paginationRow}>
        <Text style={styles.paginationLabel}>Page size:</Text>
        {[10, 20, 50, 100].map((n) => (
          <Pressable key={n} style={[styles.pageSizeBtn, pageSize === n && styles.pageSizeBtnActive]} onPress={() => setPageSize(n)}>
            <Text style={[styles.pageSizeText, pageSize === n && styles.pageSizeTextActive]}>{n}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable style={[styles.pageNavBtn, page <= 1 && styles.pageNavBtnDisabled]} onPress={() => page > 1 && setPage(page - 1)} disabled={page <= 1}>
          <Text style={[styles.pageNavText, page <= 1 && styles.pageNavTextDisabled]}>Prev</Text>
        </Pressable>
        <Text style={styles.pageIndicator}>Page {page} / {totalPages}</Text>
        <Pressable style={[styles.pageNavBtn, page >= totalPages && styles.pageNavBtnDisabled]} onPress={() => page < totalPages && setPage(page + 1)} disabled={page >= totalPages}>
          <Text style={[styles.pageNavText, page >= totalPages && styles.pageNavTextDisabled]}>Next</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && (
        <FlatList
          data={paged}
          keyExtractor={(item, idx) => String(item.transaction_id || idx)}
          renderItem={({ item }) => (
            <View style={styles.event}>
              <Text style={styles.eventTitle}>Txn {item.transaction_id}</Text>
              <Text style={styles.eventMeta}>{item.timestamp || ''} • {item.regulator || ''} • {item.booking_jurisdiction || ''}</Text>
              <Text style={styles.eventBody}>{item.event}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.body}>No audit events available.</Text>}
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
  event: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  eventTitle: { fontSize: 16, fontWeight: '600' },
  eventMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  eventBody: { fontSize: 13, color: '#333', marginTop: 6 },
  paginationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  paginationLabel: { fontSize: 12, color: '#555' },
  pageSizeBtn: { borderColor: '#ccc', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pageSizeBtnActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  pageSizeText: { color: '#333', fontFamily: 'Inter-Medium' },
  pageSizeTextActive: { color: '#fff' },
  pageNavBtn: { backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  pageNavBtnDisabled: { backgroundColor: '#9ca3af' },
  pageNavText: { color: '#fff', fontFamily: 'Inter-SemiBold' },
  pageNavTextDisabled: { color: '#e5e7eb' },
  pageIndicator: { fontSize: 12, color: '#555' },
});