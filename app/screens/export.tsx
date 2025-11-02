import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Linking } from 'react-native';
import { api } from '../utils/api';

type Flag = {
  transaction_id?: string | number;
  amount?: number;
  currency?: string;
  regulator?: string;
  booking_jurisdiction?: string;
  customer_id?: string | number;
  customer_risk_rating?: string | number;
  risk_category?: string;
  suspicious_detection_count?: number;
  reasons?: string;
  booking_datetime?: string;
};

type MonthlyReport = {
  month: string;
  generated_at?: string;
  total_flagged?: number;
  resolved?: number;
  unresolved?: number;
  csv_url?: string;
  json_url?: string;
};

export default function ExportReports() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [docValidations, setDocValidations] = useState<any[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);

  // filters
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(''); // YYYY-MM-DD
  const [clientId, setClientId] = useState('');
  const [alertType, setAlertType] = useState(''); // maps to risk_category
  const [resolutionStatus, setResolutionStatus] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load all alerts (both unresolved and resolved within retention)
        const data = await api.flags();
        if (mounted) setFlags(data as Flag[]);
        // Load monthly reports (auto-generated and retained for 1 year)
        const reports = await api.listMonthlyReports();
        if (mounted) setMonthlyReports(reports as MonthlyReport[]);
        // Load persisted document validations
        const docs = await api.listDocValidations();
        if (mounted) setDocValidations(docs);
      } catch (e: any) {
        setError(e?.message || 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const parseDate = (s?: string) => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const derivedStatus = (f: Flag): 'resolved' | 'unresolved' => {
    // Prefer backend annotation if present
    const anyF = f as any;
    if (typeof anyF.resolved === 'boolean') return anyF.resolved ? 'resolved' : 'unresolved';
    const text = String(f.reasons || '').toLowerCase();
    if (text.includes('resolved') || text.includes('closed') || text.includes('dismissed')) return 'resolved';
    return 'unresolved';
  };

  const filtered = useMemo(() => {
    const sd = startDate ? new Date(startDate) : null;
    const ed = endDate ? new Date(endDate) : null;
    return flags.filter((f) => {
      const dt = parseDate(f.booking_datetime);
      const okStart = sd && dt ? dt >= sd : true;
      const okEnd = ed && dt ? dt <= ed : true;
      const okClient = clientId ? String(f.customer_id || '').toLowerCase().includes(clientId.trim().toLowerCase()) : true;
      const okType = alertType ? String(f.risk_category || '').toLowerCase().includes(alertType.trim().toLowerCase()) : true;
      const status = derivedStatus(f);
      const okStatus = resolutionStatus === 'all' ? true : status === resolutionStatus;
      return okStart && okEnd && okClient && okType && okStatus;
    });
  }, [flags, startDate, endDate, clientId, alertType, resolutionStatus]);

  useEffect(() => {
    setPage(1);
  }, [filtered, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paged = filtered.slice(startIdx, endIdx);

  // summaries of validation outcomes (client-side aggregation of flag reasons and categories)
  const summaries = useMemo(() => {
    const total = filtered.length;
    const byType: Record<string, number> = {};
    const byClient: Record<string, number> = {};
    let resolved = 0;
    let unresolved = 0;
    filtered.forEach((f) => {
      const t = String(f.risk_category || 'unknown');
      byType[t] = (byType[t] || 0) + 1;
      const c = String(f.customer_id || 'unknown');
      byClient[c] = (byClient[c] || 0) + 1;
      const s = derivedStatus(f);
      if (s === 'resolved') resolved++; else unresolved++;
    });
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'n/a';
    const topClient = Object.entries(byClient).sort((a, b) => b[1] - a[1])[0]?.[0] || 'n/a';
    return {
      total,
      resolved,
      unresolved,
      resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
      topType,
      topClient,
      byType,
    };
  }, [filtered]);

  // document validator decisions summary
  const docSummary = useMemo(() => {
    let accepted = 0, rejected = 0, pending = 0;
    (docValidations || []).forEach((v: any) => {
      const d = String(v.decision || '').toLowerCase();
      if (d === 'accept') accepted++; else if (d === 'reject') rejected++; else pending++;
    });
    return { accepted, rejected, pending, total: (docValidations || []).length };
  }, [docValidations]);

  // export helpers (web-safe)
  const downloadBlob = (content: Blob, filename: string) => {
    if (Platform.OS !== 'web') {
      setError('Download is supported on web preview. Use CSV API link on native.');
      return;
    }
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ filters: { startDate, endDate, clientId, alertType, resolutionStatus }, data: filtered, summaries, docValidations }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'report.json');
  };

  const toCsv = (rows: Flag[]) => {
    const headers = [
      'transaction_id','booking_datetime','customer_id','regulator','booking_jurisdiction','amount','currency','risk_category','suspicious_detection_count','reasons','resolution_status'
    ];
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = rows.map((r) => headers.map((h) => {
      const val = h === 'resolution_status' ? derivedStatus(r) : (r as any)[h];
      return esc(val);
    }).join(','));
    return [headers.join(','), ...lines].join('\n');
  };

  const exportCSV = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'report.csv');
  };

  const refreshData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.flags({ resolved: resolutionStatus === 'resolved' ? true : resolutionStatus === 'unresolved' ? false : undefined });
      setFlags(data as Flag[]);
      const reports = await api.listMonthlyReports();
      setMonthlyReports(reports as MonthlyReport[]);
      const docs = await api.listDocValidations();
      setDocValidations(docs);
    } catch (e: any) {
      setError(e?.message || 'Failed to refresh report data');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setClientId('');
    setAlertType('');
    setResolutionStatus('all');
  };

  const exportPDF = () => {
    if (Platform.OS !== 'web') {
      setError('PDF export via print is supported on web preview.');
      return;
    }
    const summaryLines = [
      `Total alerts: ${summaries.total}`,
      `Resolved: ${summaries.resolved} • Unresolved: ${summaries.unresolved} • Rate: ${summaries.resolutionRate}%`,
      `Top alert type: ${summaries.topType}`,
      `Top client: ${summaries.topClient}`,
      `Docs: Accepted ${docSummary.accepted} • Rejected ${docSummary.rejected} • Pending ${docSummary.pending}`,
    ];
    const tableHeaders = ['Txn ID','Date','Client','Type','Regulator','Jurisdiction','Amount','Currency','Status'];
    const rows = filtered.slice(0, 200).map((f) => [
      String(f.transaction_id || ''),
      String(f.booking_datetime || ''),
      String(f.customer_id || ''),
      String(f.risk_category || ''),
      String(f.regulator || ''),
      String(f.booking_jurisdiction || ''),
      String(f.amount || ''),
      String(f.currency || ''),
      derivedStatus(f)
    ]);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Report</title>
      <style>body{font-family:Inter,Arial,sans-serif;padding:24px;} h1{font-size:20px;margin:0 0 8px} .muted{color:#555}
      .pill{display:inline-block;background:#eee;border-radius:16px;padding:4px 10px;margin-right:6px;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #ddd;padding:6px;font-size:12px;text-align:left}
      th{background:#f5f5f5}
      </style></head><body>
      <h1>Validation Outcomes Report</h1>
      <div class="muted">Filters: ${[startDate && `from ${startDate}`, endDate && `to ${endDate}`, clientId && `client ${clientId}`, alertType && `type ${alertType}`, resolutionStatus !== 'all' && `status ${resolutionStatus}`].filter(Boolean).join(' • ') || 'none'}</div>
      <div style="margin-top:10px">${summaryLines.map((s)=>`<span class="pill">${s}</span>`).join('')}</div>
      <table><thead><tr>${tableHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(r=>`<tr>${r.map(c=>`<td>${String(c).replace(/[<>]/g,'')}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),200)};</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Export Reports</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        <Text style={styles.subtitle}>Filters</Text>
        <View style={styles.filtersRow}>
          <TextInput placeholder="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} style={styles.input} />
          <TextInput placeholder="End date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} style={styles.input} />
          <TextInput placeholder="Client ID" value={clientId} onChangeText={setClientId} style={styles.input} />
          <TextInput placeholder="Alert type (risk category)" value={alertType} onChangeText={setAlertType} style={styles.input} />
          <View style={styles.statusRow}>
            <Pressable style={[styles.statusBtn, resolutionStatus==='all' && styles.statusBtnActive]} onPress={() => setResolutionStatus('all')}><Text style={styles.statusText}>All</Text></Pressable>
            <Pressable style={[styles.statusBtn, resolutionStatus==='resolved' && styles.statusBtnActive]} onPress={() => setResolutionStatus('resolved')}><Text style={styles.statusText}>Resolved</Text></Pressable>
            <Pressable style={[styles.statusBtn, resolutionStatus==='unresolved' && styles.statusBtnActive]} onPress={() => setResolutionStatus('unresolved')}><Text style={styles.statusText}>Unresolved</Text></Pressable>
          </View>
        </View>

        <Text style={styles.subtitle}>Auto-generated Summaries</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>Total alerts: {summaries.total}</Text>
          <Text style={styles.summaryText}>Resolved: {summaries.resolved} • Unresolved: {summaries.unresolved} • Rate: {summaries.resolutionRate}%</Text>
          <Text style={styles.summaryText}>Top alert type: {summaries.topType}</Text>
          <Text style={styles.summaryText}>Top client: {summaries.topClient}</Text>
          <Text style={styles.summaryText}>Docs decisions — Accepted: {docSummary.accepted} • Rejected: {docSummary.rejected} • Pending: {docSummary.pending}</Text>
        </View>

        <Text style={styles.subtitle}>Export</Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.btn} onPress={exportPDF}><Text style={styles.btnText}>Export as PDF</Text></Pressable>
          <Pressable style={styles.btn} onPress={exportCSV}><Text style={styles.btnText}>Export as CSV</Text></Pressable>
          <Pressable style={styles.btn} onPress={exportJSON}><Text style={styles.btnText}>Export as JSON</Text></Pressable>
          <Pressable style={styles.btnSecondary} onPress={refreshData}><Text style={styles.btnSecondaryText}>Refresh Data</Text></Pressable>
          <Pressable style={styles.btnSecondary} onPress={clearFilters}><Text style={styles.btnSecondaryText}>Clear Filters</Text></Pressable>
        </View>

        <Text style={styles.subtitle}>Raw CSV API</Text>
        <Pressable style={styles.btnSecondary} onPress={() => Linking.openURL(api.exportFraudCsvUrl({ resolved: false }))}>
          <Text style={styles.btnSecondaryText}>Download Fraud CSV (server)</Text>
        </Pressable>

        {loading && <Text style={styles.body}>Loading data…</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && (
          <View style={styles.previewBox}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewTitle}>Preview ({filtered.length} records)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.previewLabel}>Page size:</Text>
                {[10, 20, 50, 100].map((n) => (
                  <Pressable key={n} style={[styles.pageSizeBtn, pageSize === n && styles.pageSizeBtnActive]} onPress={() => setPageSize(n)}>
                    <Text style={[styles.pageSizeText, pageSize === n && styles.pageSizeTextActive]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {paged.map((f, idx) => (
              <Text key={idx} style={styles.previewRow}>
                {String(f.transaction_id || '')} • {String(f.booking_datetime || '')} • {String(f.customer_id || '')} • {String(f.risk_category || '')} • {derivedStatus(f)}
              </Text>
            ))}
            <View style={styles.previewFooterRow}>
              <Pressable style={[styles.pageNavBtn, page <= 1 && styles.pageNavBtnDisabled]} onPress={() => page > 1 && setPage(page - 1)} disabled={page <= 1}>
                <Text style={[styles.pageNavText, page <= 1 && styles.pageNavTextDisabled]}>Prev</Text>
              </Pressable>
              <Text style={styles.pageIndicator}>Page {page} / {totalPages}</Text>
              <Pressable style={[styles.pageNavBtn, page >= totalPages && styles.pageNavBtnDisabled]} onPress={() => page < totalPages && setPage(page + 1)} disabled={page >= totalPages}>
                <Text style={[styles.pageNavText, page >= totalPages && styles.pageNavTextDisabled]}>Next</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.subtitle}>Monthly Reports</Text>
        <Text style={styles.previewLabel}>Reports are auto-generated monthly and auto-deleted after 1 year.</Text>
        {monthlyReports.length === 0 ? (
          <Text style={styles.previewMore}>No monthly reports yet. They will appear here automatically.</Text>
        ) : (
          <View style={styles.previewBox}>
            {monthlyReports.map((rep) => (
              <View key={rep.month} style={{ marginBottom: 8 }}>
                <Text style={styles.previewRow}>Month: {rep.month} | Generated: {rep.generated_at || 'n/a'} | Total: {rep.total_flagged ?? 'n/a'} | Resolved: {rep.resolved ?? 'n/a'} | Unresolved: {rep.unresolved ?? 'n/a'}</Text>
                <View style={styles.btnRow}>
                  {rep.csv_url && (
                    <Pressable style={styles.btn} onPress={() => Linking.openURL(api.downloadMonthlyReportUrl(rep.month, 'csv'))}>
                      <Text style={styles.btnText}>Download CSV</Text>
                    </Pressable>
                  )}
                  {rep.json_url && (
                    <Pressable style={styles.btnSecondary} onPress={() => Linking.openURL(api.downloadMonthlyReportUrl(rep.month, 'json'))}>
                      <Text style={styles.btnSecondaryText}>View JSON</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  title: { fontSize: 22, fontFamily: 'Inter-SemiBold', marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: 'Inter-Medium', marginBottom: 10, marginTop: 12 },
  body: { fontSize: 14, fontFamily: 'Inter-Regular' },
  error: { color: '#b00020', marginTop: 8 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { borderColor: '#ccc', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, minWidth: 180 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBtn: { backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  statusBtnActive: { backgroundColor: '#1a73e8' },
  statusText: { color: '#333', fontFamily: 'Inter-SemiBold' },
  summaryBox: { backgroundColor: '#f7f7f7', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#eee' },
  summaryText: { fontSize: 13, color: '#333', marginBottom: 4 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn: { backgroundColor: '#1a73e8', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: '#fff', fontFamily: 'Inter-SemiBold' },
  btnSecondary: { backgroundColor: '#eee', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start' },
  btnSecondaryText: { color: '#333', fontFamily: 'Inter-SemiBold' },
  previewBox: { marginTop: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 },
  previewTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', marginBottom: 6 },
  previewRow: { fontSize: 12, color: '#333' },
  previewMore: { fontSize: 12, color: '#777', marginTop: 6 },
  previewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  previewLabel: { fontSize: 12, color: '#555' },
  previewFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
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