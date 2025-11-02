import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { api } from '../utils/api';
import { Role } from '../utils/auth/roles';

type AlertsProps = { role: Role; clientIds?: string[]; onOpenAudit?: (transactionId: string) => void };
const fullAccessRoles: Role[] = ['legal', 'comp', 'superadmin'];

export default function Alerts({ role, clientIds = [], onOpenAudit }: AlertsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [customerIdSearch, setCustomerIdSearch] = useState('');
  const [transactionIdSearch, setTransactionIdSearch] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query params based on role and search
      const params: any = {};
      if (role === 'front' && clientIds.length) {
        params.customer_ids = clientIds;
      }
      if (fullAccessRoles.includes(role)) {
        if (customerIdSearch.trim()) params.customer_id = customerIdSearch.trim();
        if (transactionIdSearch.trim()) params.transaction_id = transactionIdSearch.trim();
      }
      // Default to unresolved alerts for all roles
      params.resolved = false;
      const data = await api.flags(params);
      setAlerts(data);
    } catch (e: any) {
      // Robust fallback: clear list but show error; allow retry
      setAlerts([]);
      setError(e?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (txnId: string) => {
    try {
      setResolvingId(txnId);
      await api.resolveAlert(String(txnId));
      // Remove resolved item from the current list (since we show unresolved only)
      setAlerts((prev) => prev.filter((a) => String(a.transaction_id) !== String(txnId)));
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve alert');
    } finally {
      setResolvingId(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await fetchAlerts();
    };
    init();
    return () => { mounted = false; };
    // Re-run when role or clientIds change to keep scoping accurate
  }, [role, clientIds.join(',')]);

  // Reset to first page when alerts or pageSize change
  useEffect(() => {
    setPage(1);
  }, [alerts, pageSize]);

  const totalPages = Math.max(1, Math.ceil(alerts.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pagedAlerts = alerts.slice(startIdx, endIdx);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alerts</Text>
      {fullAccessRoles.includes(role) ? (
        <View style={styles.filtersRow}>
          <TextInput
            placeholder="Search by Client ID"
            value={customerIdSearch}
            onChangeText={setCustomerIdSearch}
            style={styles.input}
          />
          <TextInput
            placeholder="Search by Transaction ID"
            value={transactionIdSearch}
            onChangeText={setTransactionIdSearch}
            style={styles.input}
          />
          <Pressable style={styles.searchBtn} onPress={fetchAlerts}>
            <Text style={styles.searchText}>Search</Text>
          </Pressable>
          <Pressable
            style={[styles.searchBtn, { backgroundColor: '#eee' }]} 
            onPress={() => { setCustomerIdSearch(''); setTransactionIdSearch(''); fetchAlerts(); }}
          >
            <Text style={[styles.searchText, { color: '#333' }]}>Clear</Text>
          </Pressable>
        </View>
      ) : role === 'front' && clientIds.length ? (
        <Text style={styles.scopeNote}>Scoped to your clients: {clientIds.join(', ')}</Text>
      ) : null}
      {loading && <ActivityIndicator />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && (
        <>
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
          <FlatList
          data={pagedAlerts}
          keyExtractor={(item) => String(item.transaction_id)}
          contentContainerStyle={{ paddingTop: 8 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Txn {item.transaction_id}</Text>
              <Text style={styles.cardMeta}>
                {item.currency || ''} {item.amount || ''} • {item.regulator || ''} • {item.booking_jurisdiction || ''}
              </Text>
              <Text style={styles.badge}>{item.risk_category || 'Unknown'}</Text>
              <Text style={styles.reasons}>{item.reasons || 'No suspicious indicators'}</Text>
              {onOpenAudit && (
                <View style={styles.actionsRow}>
                  <Pressable style={styles.auditBtn} onPress={() => onOpenAudit(String(item.transaction_id))}>
                    <Text style={styles.auditText}>View Audit Trail</Text>
                  </Pressable>
                </View>
              )}
              {(role === 'comp' || role === 'superadmin') && (
                <View style={styles.actionsRow}>
                  {item.resolved ? (
                    <Text style={styles.resolvedBadge}>Resolved</Text>
                  ) : (
                    <Pressable
                      style={[styles.resolveBtn, resolvingId === String(item.transaction_id) && styles.resolveBtnDisabled]}
                      onPress={() => handleResolve(String(item.transaction_id))}
                      disabled={resolvingId === String(item.transaction_id)}
                    >
                      <Text style={styles.resolveText}>{resolvingId === String(item.transaction_id) ? 'Resolving…' : 'Resolve'}</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.text}>No suspicious alerts found.</Text>}
        />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontFamily: 'Inter-SemiBold', marginBottom: 12 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  input: { borderColor: '#ccc', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, minWidth: 160 },
  searchBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  searchText: { color: '#fff', fontFamily: 'Inter-SemiBold' },
  scopeNote: { marginBottom: 8, color: '#555' },
  text: { fontSize: 16, color: '#444' },
  error: { color: '#b00020', marginVertical: 8 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  badge: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#1a73e8' },
  reasons: { marginTop: 6, fontSize: 13, color: '#333' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  resolveBtn: { backgroundColor: '#16a34a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  resolveBtnDisabled: { backgroundColor: '#9ca3af' },
  resolveText: { color: '#fff', fontFamily: 'Inter-SemiBold' },
  resolvedBadge: { backgroundColor: '#e5e7eb', color: '#111827', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontFamily: 'Inter-Medium' },
  auditBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  auditText: { color: '#fff', fontFamily: 'Inter-SemiBold' },
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